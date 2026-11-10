import { initialAuth } from './domain';
import type { State } from './domain';
import { atomic, getState, mutate } from './store';
import { apiPost, apiGet, fetchCSRF, setAccessToken, ApiError } from './api';
import { DEMO_ACCOUNT_IDS, DEMO_LOGIN } from './config';
export const DEMO_PASSWORD = 'Stockdrop123!';
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
export const validPassword = (value: string) => value.length >= 8 && value.length <= 32 && /[a-zA-Z]/.test(value) && /\d/.test(value) && /[^a-zA-Z0-9\s]/.test(value) && !/\s/.test(value);
export function signedIn(s: State) { return !!s.auth?.userId && s.auth.userId === s.activeUserId && s.users.some(u => u.id === s.auth!.userId); }
export function safeNext(value: string | null | undefined) { return value && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) && !/^\/(login|signup|welcome|onboarding|reset-password)(\/|\?|$)/.test(value) ? value : '/'; }
export const loginHref = (next: string) => `/login?next=${encodeURIComponent(safeNext(next))}`;
function ensure(s: State) { return s.auth ??= initialAuth(); }
export function selectProfile(s: State, id: string) { const user = s.users.find(u => u.id === id); if (!user) throw new Error('계정을 찾을 수 없습니다.'); const a = ensure(s); a.userId = id; a.onboarded = true; s.activeUserId = id; s.mode = user.admin ? 'admin' : 'buyer'; }
/** 데모 로그인 — 서버 없이 목업 계정으로 로그인 (VITE_DEMO_LOGIN일 때만) */
export function demoLogin(id: string) { if (!DEMO_LOGIN) throw new Error('데모 로그인을 사용할 수 없습니다.'); mutate(s => { selectProfile(s, id); ensure(s).demo = true; }); }
export function endSession(s: State) { ensure(s).demo = false; ensure(s).userId = null; s.activeUserId = ''; s.mode = 'buyer'; }
export async function logout() {
  try { const { token, headerName } = await fetchCSRF(); await apiPost('/auth/logout', {}, { [headerName]: token }); } catch {}
  setAccessToken(null);
  mutate(endSession);
}
export async function sendCode(emailValue: string, purpose: 'signup' | 'reset') {
  const email = normalizeEmail(emailValue);
  if (!validEmail(email)) throw new Error('올바른 이메일 주소를 입력해 주세요.');
  const now = Date.now(), key = `${purpose}:${email}`;
  const old = getState().auth?.challenges[key];
  if (old && now - old.sentAt < 60_000) throw new Error('인증번호는 60초 후 다시 요청할 수 있습니다.');
  const path = purpose === 'signup' ? '/auth/email-verifications' : '/auth/password-resets';
  const data = await apiPost(path, { email }) as { challengeId: string; expiresAt: string; resendAvailableAt: string };
  const expiresAt = new Date(data.expiresAt).getTime(), resendAvailableAt = new Date(data.resendAvailableAt).getTime();
  await atomic(s => { ensure(s).challenges[key] = { email, purpose, code: '', challengeId: data.challengeId, sentAt: resendAvailableAt - 60_000, expiresAt, attempts: 0, verified: false }; });
}
export async function verifyCode(email: string, purpose: 'signup' | 'reset', code: string): Promise<string | null> {
  const nEmail = normalizeEmail(email), key = `${purpose}:${nEmail}`;
  const c = getState().auth?.challenges[key];
  if (!c?.challengeId) return '인증번호를 먼저 요청해 주세요.';
  const path = purpose === 'signup' ? '/auth/email-verifications/confirm' : '/auth/password-resets/confirm';
  try {
    const data = await apiPost(path, { email: nEmail, challengeId: c.challengeId, code }) as { verificationToken?: string; resetToken?: string };
    const token = data.verificationToken ?? data.resetToken ?? '';
    await atomic(s => { const ch = s.auth?.challenges[key]; if (ch) { ch.verified = true; ch.token = token; } });
    return null;
  } catch (e) { return (e as Error).message; }
}
export async function login(emailValue: string, password: string) {
  const email = normalizeEmail(emailValue);
  if (DEMO_LOGIN) { const demo = getState().users.find(u => DEMO_ACCOUNT_IDS.includes(u.id) && normalizeEmail(u.email) === email); if (demo) { if (password !== DEMO_PASSWORD) throw new Error('이메일 또는 비밀번호를 확인해 주세요.'); demoLogin(demo.id); return; } }
  const { token, headerName } = await fetchCSRF();
  const data = await apiPost('/auth/login', { email, password }, { [headerName]: token }) as { accessToken: string; accountId: string; roles: string[] };
  setAccessToken(data.accessToken);
  await atomic(s => {
    let user = s.users.find(u => normalizeEmail(u.email) === email);
    const seller = data.roles.some(r => r.toUpperCase() === 'SELLER'), admin = data.roles.some(r => r.toUpperCase() === 'ADMIN');
    if (user) { user.id = data.accountId; user.seller = seller; user.admin = admin; }
    else { user = { id: data.accountId, name: email.split('@')[0], email, phone: '', seller, admin }; s.users.push(user); }
    selectProfile(s, data.accountId);
  });
  // sync display name from server (fire-and-forget)
  apiGet('/accounts/me').then((me: any) => {
    if (me?.name) mutate(s => { const u = s.users.find(u => u.id === data.accountId); if (u) u.name = me.name; });
  }).catch(() => {});
}
export async function signup(input: { email: string; password: string; name: string; phone: string; age: boolean; terms: boolean; privacy: boolean; marketing: boolean }) {
  if (!validPassword(input.password)) throw new Error('비밀번호는 영문·숫자·특수문자를 포함한 8~32자로 입력해 주세요.');
  if (!input.name.trim() || input.name.trim().length > 30) throw new Error('이름을 입력해 주세요.');
  if (!input.age || !input.terms || !input.privacy) throw new Error('필수 약관에 동의해 주세요.');
  const email = normalizeEmail(input.email), key = `signup:${email}`;
  const c = getState().auth?.challenges[key];
  if (!c?.verified || !c.token) throw new Error('이메일 인증을 다시 진행해 주세요.');
  await apiPost('/auth/signup', { email, password: input.password, name: input.name.trim(), verificationToken: c.token, marketingConsent: input.marketing });
  await login(email, input.password);
  await atomic(s => {
    const user = s.users.find(u => normalizeEmail(u.email) === email);
    if (user) { user.name = input.name.trim(); user.phone = input.phone.replace(/\D/g, ''); }
    delete s.auth?.challenges[key];
  });
}
export async function restoreSession(): Promise<boolean> {
  try {
    const { token, headerName } = await fetchCSRF();
    const data = await apiPost('/auth/refresh', {}, { [headerName]: token }) as { accessToken: string; accountId: string; roles: string[] };
    setAccessToken(data.accessToken);
    if (data.accountId && Array.isArray(data.roles)) {
      const seller = data.roles.some(r => r.toUpperCase() === 'SELLER');
      const admin = data.roles.some(r => r.toUpperCase() === 'ADMIN');
      mutate(s => { const u = s.users.find(u => u.id === data.accountId); if (u) { u.seller = seller; u.admin = admin; } });
    }
    return true;
  } catch (e) {
    setAccessToken(null);
    // only log out on explicit auth rejection (401/403); network errors and 404 keep mock session intact
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) mutate(endSession);
    return false;
  }
}
export async function changePassword(currentPassword: string, newPassword: string) {
  if (!validPassword(newPassword)) throw new Error('비밀번호는 영문·숫자·특수문자를 포함한 8~32자로 입력해 주세요.');
  const { token, headerName } = await fetchCSRF();
  await apiPost('/accounts/me/password', { currentPassword, newPassword }, { [headerName]: token });
}
export async function resetPassword(emailValue: string, password: string) {
  if (!validPassword(password)) throw new Error('영문·숫자·특수문자를 포함한 8~32자로 입력해 주세요.');
  const email = normalizeEmail(emailValue), key = `reset:${email}`;
  const c = getState().auth?.challenges[key];
  if (!c?.verified || !c.token) throw new Error('이메일 인증을 다시 진행해 주세요.');
  await apiPost('/auth/password-resets/complete', { email, resetToken: c.token, newPassword: password });
  mutate(s => { delete s.auth?.challenges[key]; delete s.auth?.loginFailures?.[email]; const user = s.users.find(u => normalizeEmail(u.email) === email); if (user && s.auth?.userId === user.id) endSession(s); });
}
