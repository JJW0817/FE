import { initialAuth } from './domain';
import type { State } from './domain';
import { atomic, getState, mutate } from './store';
import { api, ApiError, errorMessage, homePathFor, rolesToFlags } from './api';
import type { AccountDto, AuthTokens, ChallengeDto, LoginDto, ResetTokenDto, VerificationTokenDto } from './api';
import { DEMO_ACCOUNT_IDS, DEMO_LOGIN, USE_MOCK } from './config';
import { disablePush } from './push';
export const DEMO_PASSWORD = 'Stockdrop123!';
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
export const validPassword = (value: string) => value.length >= 8 && value.length <= 64 && /[a-zA-Z]/.test(value) && /\d/.test(value) && /[^a-zA-Z0-9\s]/.test(value) && !/\s/.test(value);
export function signedIn(s: State) { return !!s.auth?.userId && s.auth.userId === s.activeUserId && s.users.some(u => u.id === s.auth!.userId); }
export function safeNext(value: string | null | undefined) { return value && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) && !/^\/(login|signup|welcome|onboarding|reset-password)(\/|\?|$)/.test(value) ? value : '/'; }
export const loginHref = (next: string) => `/login?next=${encodeURIComponent(safeNext(next))}`;
function ensure(s: State) { return s.auth ??= initialAuth(); }
export function selectProfile(s: State, id: string) { const user = s.users.find(u => u.id === id); if (!user) throw new Error('계정을 찾을 수 없습니다.'); const a = ensure(s); a.userId = id; a.onboarded = true; s.activeUserId = id; s.mode = user.admin ? 'admin' : 'buyer'; }
/** 데모 로그인 — 서버 없이 목업 계정으로 로그인 (mock 모드일 때만) */
export function demoLogin(id: string) { if (!DEMO_LOGIN) throw new Error('데모 로그인을 사용할 수 없습니다.'); mutate(s => { selectProfile(s, id); ensure(s).demo = true; }); }
export function endSession(s: State) { ensure(s).demo = false; ensure(s).userId = null; s.activeUserId = ''; s.mode = 'buyer'; }

/* ── 세션 연동: 재발급 실패 시 로그아웃(보호된 화면은 App이 로그인으로 보낸다), 재발급 시 역할 갱신 ── */
api.configure({
  onSessionExpired: () => { if (signedIn(getState())) mutate(endSession); },
  onRefreshed: syncRoles,
});
/** 토큰의 roles를 현재 계정의 판매자·운영자 플래그에 반영한다 (판매자 승인 직후 재발급 등) */
function syncRoles(tokens: Pick<AuthTokens, 'accountId' | 'roles'>) {
  if (!tokens.accountId || !Array.isArray(tokens.roles)) return;
  const flags = rolesToFlags(tokens.roles), user = getState().users.find(u => u.id === tokens.accountId);
  if (user && (user.seller !== flags.seller || user.admin !== flags.admin)) mutate(s => { const u = s.users.find(u => u.id === tokens.accountId); if (u) Object.assign(u, flags); });
}
/** 지금 로그인한 계정이 처음 가야 할 화면 (운영자 /admin, 판매자 /seller, 그 외 홈) */
export function homePath(s: State = getState()) { const u = s.users.find(u => u.id === s.activeUserId); return u ? homePathFor({ seller: u.seller, admin: u.admin }) : '/'; }

export async function logout() {
  if (!USE_MOCK) await disablePush(); // 명세: 로그아웃 전에 푸시 구독 해제(JWT 필요) 후 브라우저 unsubscribe
  try { await api.post('/v1/auth/logout', undefined, { csrf: true, auth: false }); } catch { /* 서버에 닿지 않아도 이 기기의 세션은 끝낸다 */ }
  api.setAccessToken(null);
  mutate(endSession);
}
/** 서버 시각은 나노초(.200089800Z)까지 온다 — 밀리초 3자리로 잘라 파싱한다(Safari 호환) */
export const parseServerTime = (v: string) => new Date(v.replace(/(\.\d{3})\d+/, '$1')).getTime();
const sending = new Map<string, Promise<void>>();
/** 같은 목적·이메일로 발송 중이면 새 요청을 보내지 않고 진행 중인 것을 돌려준다(중복 클릭·StrictMode) */
export function sendCode(emailValue: string, purpose: 'signup' | 'reset') {
  const key = `${purpose}:${normalizeEmail(emailValue)}`;
  const running = sending.get(key);
  if (running) return running;
  const p = doSendCode(emailValue, purpose).finally(() => sending.delete(key));
  sending.set(key, p);
  return p;
}
async function doSendCode(emailValue: string, purpose: 'signup' | 'reset') {
  const email = normalizeEmail(emailValue);
  if (!validEmail(email)) throw new Error('올바른 이메일 주소를 입력해 주세요.');
  const now = Date.now(), key = `${purpose}:${email}`;
  const old = getState().auth?.challenges[key];
  if (old && now - old.sentAt < 60_000) throw new Error('인증번호는 60초 후 다시 요청할 수 있습니다.');
  const path = purpose === 'signup' ? '/v1/auth/email-verifications' : '/v1/auth/password-resets';
  let data: ChallengeDto;
  try { data = await api.post<ChallengeDto>(path, { email }, { auth: false }); } catch (e) { throw e instanceof ApiError ? new ApiError(errorMessage(e), e.status, e.code, e.traceId, e.violations) : new Error(errorMessage(e)); }
  const expiresAt = parseServerTime(data.expiresAt), resendAvailableAt = parseServerTime(data.resendAvailableAt);
  await atomic(s => { ensure(s).challenges[key] = { email, purpose, code: '', challengeId: data.challengeId, sentAt: resendAvailableAt - 60_000, expiresAt, attempts: 0, verified: false }; });
}
export async function verifyCode(email: string, purpose: 'signup' | 'reset', code: string): Promise<string | null> {
  const nEmail = normalizeEmail(email), key = `${purpose}:${nEmail}`;
  const c = getState().auth?.challenges[key];
  if (!c?.challengeId) return '인증번호를 먼저 요청해 주세요.';
  const path = purpose === 'signup' ? '/v1/auth/email-verifications/confirm' : '/v1/auth/password-resets/confirm';
  try {
    const data = await api.post<VerificationTokenDto & ResetTokenDto>(path, { email: nEmail, challengeId: c.challengeId, code }, { auth: false });
    const token = data.verificationToken ?? data.resetToken ?? '';
    await atomic(s => { const ch = s.auth?.challenges[key]; if (ch) { ch.verified = true; ch.token = token; } });
    return null;
  } catch (e) { return errorMessage(e); }
}
/** 로그인. 끝나면 이 계정이 처음 갈 화면(역할별)을 돌려준다 */
export async function login(emailValue: string, password: string): Promise<string> {
  const email = normalizeEmail(emailValue);
  if (DEMO_LOGIN) {
    const demo = getState().users.find(u => DEMO_ACCOUNT_IDS.includes(u.id) && normalizeEmail(u.email) === email);
    if (demo) { if (password !== DEMO_PASSWORD) throw new Error('이메일 또는 비밀번호를 확인해 주세요.'); demoLogin(demo.id); return '/'; }
  }
  if (USE_MOCK) throw new Error('이메일 또는 비밀번호를 확인해 주세요.');
  let data: LoginDto;
  try { data = await api.post<LoginDto>('/v1/auth/login', { email, password }, { csrf: true, auth: false }); } catch (e) { throw new Error(errorMessage(e)); }
  api.setAccessToken(data.accessToken);
  const flags = rolesToFlags(data.roles);
  await atomic(s => {
    let user = s.users.find(u => normalizeEmail(u.email) === email);
    if (user) { user.id = data.accountId; Object.assign(user, flags); }
    else { user = { id: data.accountId, name: email.split('@')[0], email, phone: '', ...flags }; s.users.push(user); }
    selectProfile(s, data.accountId);
  });
  // 표시 이름은 서버 값으로 맞춘다 (실패해도 로그인은 유지)
  api.get<AccountDto>('/v1/accounts/me').then(me => { if (me?.name) mutate(s => { const u = s.users.find(u => u.id === data.accountId); if (u) u.name = me.name; }); }).catch(() => {});
  return homePath();
}
export async function signup(input: { email: string; password: string; name: string; phone: string; age: boolean; terms: boolean; privacy: boolean; marketing: boolean }) {
  if (!validPassword(input.password)) throw new Error('비밀번호는 영문·숫자·특수문자를 포함한 8~64자로 입력해 주세요.');
  if (!input.name.trim() || input.name.trim().length > 30) throw new Error('이름을 입력해 주세요.');
  if (!input.age || !input.terms || !input.privacy) throw new Error('필수 약관에 동의해 주세요.');
  const email = normalizeEmail(input.email), key = `signup:${email}`;
  const c = getState().auth?.challenges[key];
  if (!c?.verified || !c.token) throw new Error('이메일 인증을 다시 진행해 주세요.');
  // 가입 API는 토큰을 발급하지 않으므로 가입 뒤 이어서 로그인한다. 전화번호는 가입 API에 없다(docs/api-gap.md)
  try { await api.post('/v1/auth/signup', { email, password: input.password, name: input.name.trim(), verificationToken: c.token, marketingConsent: input.marketing }, { auth: false }); } catch (e) { throw new Error(errorMessage(e)); }
  await login(email, input.password);
  await atomic(s => {
    const user = s.users.find(u => normalizeEmail(u.email) === email);
    if (user) { user.name = input.name.trim(); user.phone = input.phone.replace(/\D/g, ''); }
    delete s.auth?.challenges[key];
  });
}
/** 앱을 다시 열었을 때 Refresh 쿠키로 Access JWT를 복원한다. 서버가 거절(401·403)하면 이 기기의 로그인을 끝낸다 */
export async function restoreSession(): Promise<boolean> {
  try { await api.refresh(); return true; }
  catch (e) {
    // 네트워크 오류·서버 오류·mock 모드에서는 저장된 세션을 그대로 둔다
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) mutate(endSession);
    return false;
  }
}
export async function changePassword(currentPassword: string, newPassword: string) {
  if (!validPassword(newPassword)) throw new Error('비밀번호는 영문·숫자·특수문자를 포함한 8~64자로 입력해 주세요.');
  try { await api.put('/v1/accounts/me/password', { currentPassword, newPassword }); } catch (e) { throw new Error(errorMessage(e)); }
}
export async function resetPassword(emailValue: string, password: string) {
  if (!validPassword(password)) throw new Error('영문·숫자·특수문자를 포함한 8~64자로 입력해 주세요.');
  const email = normalizeEmail(emailValue), key = `reset:${email}`;
  const c = getState().auth?.challenges[key];
  if (!c?.verified || !c.token) throw new Error('이메일 인증을 다시 진행해 주세요.');
  try { await api.post('/v1/auth/password-resets/complete', { email, resetToken: c.token, newPassword: password }, { auth: false }); } catch (e) { throw new Error(errorMessage(e)); }
  mutate(s => { delete s.auth?.challenges[key]; delete s.auth?.loginFailures?.[email]; const user = s.users.find(u => normalizeEmail(u.email) === email); if (user && s.auth?.userId === user.id) { api.setAccessToken(null); endSession(s); } });
}
