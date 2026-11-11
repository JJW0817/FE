/**
 * STOCKDROP API 클라이언트 (1개). 규칙은 docs/api-spec.md 0절.
 * - 상대 경로만 쓴다: Gateway `/api`, PurchaseGateway `/pg/api`(services.ts). 배포는 vercel.json rewrites, 로컬은 vite proxy가 터널·서버로 넘긴다. 경로는 명세 그대로 `/v1/...`
 * - Access JWT 자동 첨부, 401이면 재발급(`/v1/auth/refresh`) 후 1회 재시도, 재발급 실패 시 세션 종료 콜백
 * - 성공 응답 `{ success, code, message, data }`는 `data`만 돌려주고, 에러 `{ code, message, traceId, violations }`는 ApiError로 던진다
 * - login·logout·refresh처럼 CSRF가 필요한 호출은 `csrf: true`
 */
import { USE_MOCK } from '../config';
import { SERVICE_BASE } from './services';
import type { Service } from './services';

export interface Violation { field: string; message: string }
export class ApiError extends Error {
  constructor(message: string, public status: number, public code = 'UNKNOWN', public traceId?: string, public violations: Violation[] = []) { super(message); this.name = 'ApiError'; }
}
export const MOCK_CODE = 'MOCK_MODE';
export const NETWORK_CODE = 'NETWORK';

export interface RequestOptions {
  /** 어느 서비스로 보낼지 (기본 account). 주소는 services.ts */
  service?: Service;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  /** multipart 본문. Content-Type은 브라우저가 boundary와 함께 정한다 */
  form?: FormData;
  /** false면 Authorization을 붙이지 않고 401 재발급도 하지 않는다 (로그인·가입·인증번호 등) */
  auth?: boolean;
  /** CSRF 토큰 헤더를 붙인다 (login, logout, refresh) */
  csrf?: boolean;
  /** PDF·이미지 같은 비-JSON 응답 */
  responseType?: 'json' | 'blob';
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface AuthTokens { accessToken: string; tokenType: string; expiresAt: string; accountId: string; roles: string[] }
export interface ClientConfig {
  fetch?: typeof fetch;
  base?: string;
  /** 서비스별 기본 주소. 기본은 services.ts의 SERVICE_BASE */
  services?: Partial<Record<Service, string>>;
  /** true면 네트워크를 쓰지 않고 `MOCK_MODE` 에러를 던진다 */
  mock?: boolean;
  /** 재발급 실패(또는 401 재시도 후에도 401)로 세션을 끝내야 할 때 */
  onSessionExpired?: () => void;
  /** 재발급 성공 시 (역할 변경 반영용) */
  onRefreshed?: (tokens: AuthTokens) => void;
}

const DEFAULT_MESSAGE = '요청에 실패했어요. 잠시 후 다시 시도해 주세요.';

export function createApiClient(initial: ClientConfig = {}) {
  const cfg: Required<Pick<ClientConfig, 'base' | 'mock'>> & ClientConfig = { base: '/api', mock: false, services: SERVICE_BASE, ...initial };
  let accessToken: string | null = null;
  let refreshing: Promise<AuthTokens> | null = null;
  const doFetch = (...args: Parameters<typeof fetch>) => (cfg.fetch ?? fetch)(...args);

  const url = (path: string, query?: RequestOptions['query'], service: Service = 'account') => {
    const q = query ? Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&') : '';
    return `${cfg.services?.[service] ?? cfg.base}${path}${q ? `${path.includes('?') ? '&' : '?'}${q}` : ''}`;
  };

  async function toError(res: Response): Promise<ApiError> {
    let body: { code?: string; message?: string; traceId?: string; violations?: Violation[] } | null = null;
    try { body = await res.json(); } catch { /* 본문이 JSON이 아닌 오류 */ }
    return new ApiError(body?.message || DEFAULT_MESSAGE, res.status, body?.code || `HTTP_${res.status}`, body?.traceId, body?.violations ?? []);
  }

  async function parse<T>(res: Response, type: RequestOptions['responseType']): Promise<T> {
    if (!res.ok) throw await toError(res);
    if (res.status === 204) return null as T;
    const contentType = res.headers.get('content-type') ?? '';
    if (type === 'blob' || !contentType.includes('json')) return (type === 'blob' ? await res.blob() : null) as T;
    const body = await res.json().catch(() => null);
    return (body && typeof body === 'object' && 'success' in body ? (body as { data: T }).data : body) as T;
  }

  /** 쿠키 요청(login·refresh·logout) 직전마다 새로 받는다. 캐시 금지 — 로그인 성공 등으로 토큰이 바뀐다(서버 안내). 항상 /api(account)로 간다 */
  async function getCsrf() {
    const res = await send('GET', '/v1/auth/csrf', { auth: false });
    return parse<{ headerName: string; token: string }>(res, 'json');
  }

  async function send(method: string, path: string, o: RequestOptions): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json', ...o.headers };
    if (o.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (o.csrf) { const c = await getCsrf(); headers[c.headerName] = c.token; }
    let body: BodyInit | undefined;
    if (o.form) body = o.form;
    else if (o.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.body); }
    try { return await doFetch(url(path, o.query, o.service), { method, headers, body, credentials: 'include', signal: o.signal }); }
    catch (e) { if ((e as Error).name === 'AbortError') throw e; throw new ApiError('서버에 연결할 수 없어요. 네트워크를 확인하고 다시 시도해 주세요.', 0, NETWORK_CODE); }
  }

  /**
   * Access JWT 재발급. 동시에 여러 요청이 401을 받거나 앱 시작 복원과 겹쳐도 한 번만 호출한다
   * (Refresh Token은 호출마다 교체되고 재사용하면 세션이 폐기되기 때문).
   */
  function refresh(): Promise<AuthTokens> {
    if (cfg.mock) return Promise.reject(new ApiError('mock 모드에서는 서버를 호출하지 않아요.', 0, MOCK_CODE));
    return refreshing ??= (async () => {
      try {
        const res = await send('POST', '/v1/auth/refresh', { auth: false, csrf: true });
        const tokens = await parse<AuthTokens>(res, 'json');
        accessToken = tokens.accessToken; cfg.onRefreshed?.(tokens); return tokens;
      } catch (e) { accessToken = null; throw e; }
      finally { refreshing = null; }
    })();
  }

  async function request<T>(method: string, path: string, o: RequestOptions = {}): Promise<T> {
    if (cfg.mock) throw new ApiError('mock 모드에서는 서버를 호출하지 않아요.', 0, MOCK_CODE);
    let res = await send(method, path, o);
    // CSRF가 거절되면 한 번만 재시도(send가 토큰을 새로 받는다)
    if (res.status === 403 && o.csrf) { const err = await toError(res.clone()); if (err.code === 'COMMON_CSRF_REJECTED') res = await send(method, path, o); }
    if (res.status === 401 && o.auth !== false) {
      let renewed = false, rejected = true;
      try { await refresh(); renewed = true; } catch (e) { rejected = !(e instanceof ApiError) || (e.status > 0 && e.status < 500); }
      if (renewed) res = await send(method, path, o);
      // 재발급이 거절됐거나(401·403 등) 재시도에도 401이면 세션 종료. 네트워크 단절·서버 오류로 재발급을 못 한 경우는 로그아웃하지 않는다
      if ((renewed || rejected) && res.status === 401) { accessToken = null; cfg.onSessionExpired?.(); }
    }
    return parse<T>(res, o.responseType);
  }

  return {
    request,
    get: <T>(path: string, o?: RequestOptions) => request<T>('GET', path, o),
    post: <T>(path: string, body?: unknown, o?: RequestOptions) => request<T>('POST', path, { ...o, body }),
    put: <T>(path: string, body?: unknown, o?: RequestOptions) => request<T>('PUT', path, { ...o, body }),
    patch: <T>(path: string, body?: unknown, o?: RequestOptions) => request<T>('PATCH', path, { ...o, body }),
    delete: <T>(path: string, o?: RequestOptions) => request<T>('DELETE', path, o),
    /** multipart 업로드 (입점 신청, 사업자등록증, 로고) */
    upload: <T>(method: 'POST' | 'PUT', path: string, form: FormData, o?: RequestOptions) => request<T>(method, path, { ...o, form }),
    refresh,
    getAccessToken: () => accessToken,
    setAccessToken: (token: string | null) => { accessToken = token; },
    configure: (next: ClientConfig) => { Object.assign(cfg, next); },
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;

/** 앱 전체에서 쓰는 클라이언트. mock 모드면 서버를 호출하지 않는다 */
export const api = createApiClient({ mock: USE_MOCK });
