import { initialAuth } from './domain';
import type { State } from './domain';
import { atomic, getState, mutate } from './store';
import { apiPost, fetchCSRF, setAccessToken } from './api';
export const DEMO_PASSWORD = 'Stockdrop123!';
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
export const validPassword = (value: string) => value.length >= 8 && value.length <= 32 && /[a-zA-Z]/.test(value) && /\d/.test(value) && /[^a-zA-Z0-9\s]/.test(value) && !/\s/.test(value);
export function signedIn(s: State) { return !!s.auth?.userId && s.auth.userId === s.activeUserId && s.users.some(u => u.id === s.auth!.userId); }
export function safeNext(value: string | null | undefined) { return value && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) && !/^\/(login|signup|welcome|onboarding|reset-password)(\/|\?|$)/.test(value) ? value : '/'; }
export const loginHref = (next: string) => `/login?next=${encodeURIComponent(safeNext(next))}`;
function ensure(s: State) { return s.auth ??= initialAuth(); }
export function selectProfile(s: State, id: string) { const user = s.users.find(u => u.id === id); if (!user) throw new Error('계정을 찾을 수 없습니다.'); const a = ensure(s); a.userId = id; a.onboarded = true; s.activeUserId = id; s.mode = user.admin ? 'admin' : 'buyer'; }
export function endSession(s: State) { ensure(s).userId = null; s.activeUserId = ''; s.mode = 'buyer'; setAccessToken(null); }
export async function sendCode(emailValue: string, purpose: 'signup' | 'reset') {
  const email = normalizeEmail(emailValue);
  if (!validEmail(email)) throw new Error('올바른 이메일 주소를 입력해 주세요.');
  const now = Date.now(), key = `${purpose}:${email}`;
  const old = getState().auth?.challenges[key];
  if (old && now - old.sentAt < 30_000) throw new Error('인증번호는 30초 후 다시 요청할 수 있습니다.');
  const path = purpose === 'signup' ? '/auth/email-verifications' : '/auth/password-resets';
  const data = await apiPost(path, { email }) as { challengeId: string };
  await atomic(s => { ensure(s).challenges[key] = { email, purpose, code: '', challengeId: data.challengeId, sentAt: now, expiresAt: now + 180_000, attempts: 0, verified: false }; });
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
  const csrf = await fetchCSRF();
  const data = await apiPost('/auth/login', { email, password }, csrf) as { accessToken: string; accountId: string; roles: string[] };
  setAccessToken(data.accessToken);
  await atomic(s => {
    let user = s.users.find(u => normalizeEmail(u.email) === email);
    const seller = data.roles.some(r => r.toUpperCase() === 'SELLER'), admin = data.roles.some(r => r.toUpperCase() === 'ADMIN');
    if (user) { user.id = data.accountId; user.seller = seller; user.admin = admin; }
    else { user = { id: data.accountId, name: email.split('@')[0], email, phone: '', seller, admin }; s.users.push(user); }
    selectProfile(s, data.accountId);
  });
}
export async function signup(input: { email: string; password: string; name: string; phone: string; age: boolean; terms: boolean; privacy: boolean; marketing: boolean }) {
  if (!validPassword(input.password)) throw new Error('비밀번호는 영문·숫자·특수문자를 포함한 8~32자로 입력해 주세요.');
  if (!input.name.trim() || input.name.trim().length > 30 || !/^01[016789]\d{7,8}$/.test(input.phone.replace(/\D/g, ''))) throw new Error('이름과 올바른 휴대폰 번호를 입력해 주세요.');
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
export async function resetPassword(emailValue: string, password: string) {
  if (!validPassword(password)) throw new Error('영문·숫자·특수문자를 포함한 8~32자로 입력해 주세요.');
  const email = normalizeEmail(emailValue), key = `reset:${email}`;
  const c = getState().auth?.challenges[key];
  if (!c?.verified || !c.token) throw new Error('이메일 인증을 다시 진행해 주세요.');
  await apiPost('/auth/password-resets/complete', { email, resetToken: c.token, newPassword: password });
  mutate(s => { delete s.auth?.challenges[key]; delete s.auth?.loginFailures?.[email]; const user = s.users.find(u => normalizeEmail(u.email) === email); if (user && s.auth?.userId === user.id) endSession(s); });
}
