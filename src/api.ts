const BASE = '/api/v1';

let _token: string | null = null;
export const getAccessToken = () => _token;
export const setAccessToken = (t: string | null) => { _token = t; };

async function parse(r: Response): Promise<unknown> {
  if (r.ok) return r.status === 204 ? null : r.json().catch(() => null);
  let msg = '요청에 실패했어요. 잠시 후 다시 시도해 주세요.';
  try { const b = await r.json(); msg = b.message || b.error || msg; } catch {}
  throw new Error(msg);
}

export async function fetchCSRF(): Promise<{ token: string; headerName: string }> {
  const r = await fetch(`${BASE}/auth/csrf`, { credentials: 'include' });
  return (await parse(r)) as { token: string; headerName: string };
}

export async function apiPost(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<unknown> {
  const h: Record<string, string> = { 'Content-Type': 'application/json', ...extraHeaders };
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  const r = await fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', headers: h, body: JSON.stringify(body) });
  return parse(r);
}
export async function apiGet(path: string): Promise<unknown> {
  const h: Record<string, string> = {};
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  const r = await fetch(`${BASE}${path}`, { method: 'GET', credentials: 'include', headers: h });
  return parse(r);
}
export async function apiPut(path: string, body: unknown): Promise<unknown> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  const r = await fetch(`${BASE}${path}`, { method: 'PUT', credentials: 'include', headers: h, body: JSON.stringify(body) });
  return parse(r);
}
export async function apiPatch(path: string, body: unknown): Promise<unknown> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  const r = await fetch(`${BASE}${path}`, { method: 'PATCH', credentials: 'include', headers: h, body: JSON.stringify(body) });
  return parse(r);
}
export async function apiDelete(path: string): Promise<unknown> {
  const h: Record<string, string> = {};
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE', credentials: 'include', headers: h });
  return parse(r);
}
export async function apiPostForm(path: string, formData: FormData): Promise<unknown> {
  // Do NOT set Content-Type — browser sets it with boundary for multipart
  const h: Record<string, string> = {};
  if (_token) h['Authorization'] = `Bearer ${_token}`;
  const r = await fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', headers: h, body: formData });
  return parse(r);
}
