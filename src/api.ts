const BASE = 'https://lia-balsamiferous-elois.ngrok-free.dev/api/v1';
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

export async function fetchCSRF(): Promise<{ token: string; headerName: string }> {
  const r = await fetch(`${BASE}/auth/csrf`, { credentials: 'include', headers: skip });
  return (await parse(r)) as { token: string; headerName: string };
}

export async function apiPost(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<unknown> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...skip, ...extraHeaders };
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  const r = await fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify(body) });
  return parse(r);
}
