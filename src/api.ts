const BASE = 'https://lia-balsamiferous-elois.ngrok-free.app/api/v1';
// shortcut: BASE is hardcoded; change when the ngrok URL rotates

let _token: string | null = null;
export const getAccessToken = () => _token;
export const setAccessToken = (t: string | null) => { _token = t; };

const skip = { 'ngrok-skip-browser-warning': '1' };

async function parse(r: Response): Promise<unknown> {
  if (r.ok) return r.status === 204 ? null : r.json().catch(() => null);
  let msg = '요청에 실패했어요. 잠시 후 다시 시도해 주세요.';
  try { const b = await r.json(); msg = b.message || b.error || msg; } catch {}
  throw new Error(msg);
}

export async function fetchCSRF(): Promise<string> {
  const r = await fetch(`${BASE}/auth/csrf`, { credentials: 'include', headers: skip });
  return ((await parse(r)) as { csrfToken: string }).csrfToken;
}

export async function apiPost(path: string, body: unknown, csrf?: string): Promise<unknown> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...skip };
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  if (csrf) h['X-XSRF-TOKEN'] = csrf;
  const r = await fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify(body) });
  return parse(r);
}
