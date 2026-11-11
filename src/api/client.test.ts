import { describe, expect, it, vi } from 'vitest';
import { ApiError, MOCK_CODE, NETWORK_CODE, createApiClient } from './client';
import type { ClientConfig } from './client';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const ok = (data: unknown, status = 200) => json({ success: true, code: 'COMMON_SUCCESS', message: '요청이 성공했습니다.', data }, status);
const fail = (status: number, code: string, message = '실패') => json({ code, message, traceId: 'trace-1', violations: [] }, status);
const csrf = () => ok({ headerName: 'X-XSRF-TOKEN', token: 'csrf-1' });
const tokens = (accessToken: string) => ok({ accessToken, tokenType: 'Bearer', expiresAt: '2030-01-01T00:15:00Z', accountId: 'acc-1', roles: ['BUYER'] });
type Call = { url: string; method: string; headers: Record<string, string>; credentials?: RequestCredentials };

function setup(handler: (call: Call, n: number) => Response | Promise<Response>, extra: ClientConfig = {}) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = { url: String(input), method: init?.method ?? 'GET', headers: { ...(init?.headers as Record<string, string>) }, credentials: init?.credentials };
    calls.push(call); return handler(call, calls.length);
  });
  return { client: createApiClient({ fetch: fetchMock as unknown as typeof fetch, ...extra }), calls, fetchMock };
}
const path = (call: Call) => call.url.replace('/api', '');

describe('토큰 첨부', () => {
  it('Access JWT를 Bearer로 붙이고 쿠키를 포함하며 data만 돌려준다', async () => {
    const { client, calls } = setup(() => ok({ items: [1] }));
    client.setAccessToken('abc');
    await expect(client.get('/v1/products', { query: { page: 0, keyword: '코트', category: undefined } })).resolves.toEqual({ items: [1] });
    expect(calls[0].url).toBe('/api/v1/products?page=0&keyword=%EC%BD%94%ED%8A%B8');
    expect(calls[0].headers.Authorization).toBe('Bearer abc');
    expect(calls[0].credentials).toBe('include');
  });
  it('토큰이 없거나 auth:false면 Authorization을 붙이지 않는다', async () => {
    const { client, calls } = setup(() => ok(null));
    await client.get('/v1/products');
    client.setAccessToken('abc');
    await client.post('/v1/auth/email-verifications', { email: 'a@b.c' }, { auth: false });
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[1].headers.Authorization).toBeUndefined();
    expect(calls[1].headers['Content-Type']).toBe('application/json');
  });
  it('에러 응답은 code·traceId·violations를 가진 ApiError로 던진다', async () => {
    const body = { code: 'COMMON_INVALID_REQUEST', message: '요청값이 올바르지 않습니다.', traceId: 't-9', violations: [{ field: 'email', message: '입력값을 확인해 주세요.' }] };
    const { client } = setup(() => json(body, 400));
    const error = (await client.post('/v1/auth/signup', {}, { auth: false }).catch(e => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'COMMON_INVALID_REQUEST', traceId: 't-9', message: '요청값이 올바르지 않습니다.' });
    expect(error.violations).toEqual(body.violations);
  });
  it('PDF 같은 비-JSON 응답은 blob으로 받는다', async () => {
    const { client } = setup(() => new Response('%PDF-', { status: 200, headers: { 'content-type': 'application/pdf' } }));
    const blob = await client.get<Blob>('/v1/seller-applications/a1/certificate', { responseType: 'blob' });
    expect(blob.size).toBe(5);
  });
});

describe('401 재발급·재시도', () => {
  it('401이면 CSRF를 받아 재발급한 뒤 새 토큰으로 정확히 1회 재시도한다', async () => {
    const onRefreshed = vi.fn();
    const { client, calls } = setup(call => {
      if (path(call) === '/v1/auth/csrf') return csrf();
      if (path(call) === '/v1/auth/refresh') return tokens('new-token');
      return call.headers.Authorization === 'Bearer new-token' ? ok({ orderId: 'o1' }) : fail(401, 'COMMON_UNAUTHORIZED', '인증이 필요합니다.');
    }, { onRefreshed });
    client.setAccessToken('old-token');
    await expect(client.get('/v1/orders/o1')).resolves.toEqual({ orderId: 'o1' });
    expect(calls.map(c => `${c.method} ${path(c)}`)).toEqual(['GET /v1/orders/o1', 'GET /v1/auth/csrf', 'POST /v1/auth/refresh', 'GET /v1/orders/o1']);
    expect(calls[2].headers['X-XSRF-TOKEN']).toBe('csrf-1');
    expect(calls[2].headers.Authorization).toBeUndefined();
    expect(client.getAccessToken()).toBe('new-token');
    expect(onRefreshed).toHaveBeenCalledWith(expect.objectContaining({ accessToken: 'new-token' }));
  });
  it('동시에 401을 받은 요청이 여러 개여도 재발급은 한 번만 한다', async () => {
    const { client, calls } = setup(call => {
      if (path(call) === '/v1/auth/csrf') return csrf();
      if (path(call) === '/v1/auth/refresh') return tokens('new-token');
      return call.headers.Authorization === 'Bearer new-token' ? ok('fine') : fail(401, 'COMMON_UNAUTHORIZED');
    });
    client.setAccessToken('old-token');
    await Promise.all([client.get('/v1/orders'), client.get('/v1/notifications'), client.get('/v1/accounts/me')]);
    expect(calls.filter(c => path(c) === '/v1/auth/refresh')).toHaveLength(1);
  });
  it('재발급이 거절되면 세션 종료 콜백을 부르고 원래 401을 던진다 (재시도 없음)', async () => {
    const onSessionExpired = vi.fn();
    const { client, calls } = setup(call => {
      if (path(call) === '/v1/auth/csrf') return csrf();
      if (path(call) === '/v1/auth/refresh') return fail(401, 'AUTH_INVALID_REFRESH_TOKEN', '다시 로그인해 주세요.');
      return fail(401, 'COMMON_UNAUTHORIZED', '인증이 필요합니다.');
    }, { onSessionExpired });
    client.setAccessToken('old-token');
    await expect(client.get('/v1/orders')).rejects.toMatchObject({ status: 401, code: 'COMMON_UNAUTHORIZED' });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(client.getAccessToken()).toBeNull();
    expect(calls.filter(c => path(c) === '/v1/orders')).toHaveLength(1);
  });
  it('재시도해도 401이면 세션을 끝내고 더 반복하지 않는다', async () => {
    const onSessionExpired = vi.fn();
    const { client, calls } = setup(call => path(call) === '/v1/auth/csrf' ? csrf() : path(call) === '/v1/auth/refresh' ? tokens('new-token') : fail(401, 'COMMON_UNAUTHORIZED'), { onSessionExpired });
    client.setAccessToken('old-token');
    await expect(client.get('/v1/orders')).rejects.toMatchObject({ status: 401 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(calls.filter(c => path(c) === '/v1/orders')).toHaveLength(2);
    expect(calls.filter(c => path(c) === '/v1/auth/refresh')).toHaveLength(1);
  });
  it('재발급 중 네트워크 오류·서버 오류면 로그아웃하지 않는다', async () => {
    const onSessionExpired = vi.fn();
    const { client } = setup(call => path(call) === '/v1/auth/csrf' ? csrf() : path(call) === '/v1/auth/refresh' ? fail(503, 'COMMON_SERVICE_UNAVAILABLE') : fail(401, 'COMMON_UNAUTHORIZED'), { onSessionExpired });
    client.setAccessToken('old-token');
    await expect(client.get('/v1/orders')).rejects.toMatchObject({ status: 401 });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
  it('auth:false 호출(로그인 실패 등)의 401은 재발급하지 않는다', async () => {
    const onSessionExpired = vi.fn();
    const { client, calls } = setup(call => path(call) === '/v1/auth/csrf' ? csrf() : fail(401, 'AUTH_INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.'), { onSessionExpired });
    await expect(client.post('/v1/auth/login', { email: 'a@b.c', password: 'x' }, { auth: false, csrf: true })).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(calls.map(c => path(c))).toEqual(['/v1/auth/csrf', '/v1/auth/login']);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });
});

describe('CSRF·mock·네트워크', () => {
  it('CSRF 헤더가 거절되면 토큰을 다시 받아 한 번만 재시도한다', async () => {
    let n = 0;
    const { client, calls } = setup(call => {
      if (path(call) === '/v1/auth/csrf') return ok({ headerName: 'X-XSRF-TOKEN', token: `csrf-${++n}` });
      return call.headers['X-XSRF-TOKEN'] === 'csrf-2' ? tokens('t') : fail(403, 'COMMON_CSRF_REJECTED', 'CSRF 토큰을 확인해 주세요.');
    });
    await expect(client.post('/v1/auth/login', { email: 'a@b.c', password: 'p' }, { auth: false, csrf: true })).resolves.toMatchObject({ accessToken: 't' });
    expect(calls.map(c => path(c))).toEqual(['/v1/auth/csrf', '/v1/auth/login', '/v1/auth/csrf', '/v1/auth/login']);
  });
  it('mock 모드에서는 fetch를 부르지 않고 MOCK_MODE를 던진다', async () => {
    const { client, fetchMock } = setup(() => ok(null), { mock: true });
    await expect(client.get('/v1/products')).rejects.toMatchObject({ status: 0, code: MOCK_CODE });
    await expect(client.refresh()).rejects.toMatchObject({ code: MOCK_CODE });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('fetch가 실패하면 NETWORK 에러로 바꾼다', async () => {
    const { client } = setup(() => { throw new TypeError('Failed to fetch'); });
    await expect(client.get('/v1/products')).rejects.toMatchObject({ status: 0, code: NETWORK_CODE });
  });
});
