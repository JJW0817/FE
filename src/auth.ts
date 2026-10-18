import { initialAuth, uid } from './domain';
import type { State } from './domain';
import { atomic, getState } from './store';
export const DEMO_PASSWORD = 'Stockdrop123!';
export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
export const validPassword = (value: string) => value.length >= 8 && value.length <= 32 && /[a-zA-Z]/.test(value) && /\d/.test(value) && /[^a-zA-Z0-9\s]/.test(value) && !/\s/.test(value);
export function signedIn(s: State) { return !!s.auth?.userId && s.auth.userId === s.activeUserId && s.users.some(u => u.id === s.auth!.userId); }
export function safeNext(value: string | null | undefined) { return value && /^\/(?!\/)/.test(value) && !/[\\\r\n]/.test(value) && !/^\/(login|signup|welcome|onboarding|reset-password)(\/|\?|$)/.test(value) ? value : '/'; }
export const loginHref = (next: string) => `/login?next=${encodeURIComponent(safeNext(next))}`;
function ensure(s: State) { return s.auth ??= initialAuth(); }
export function selectProfile(s: State, id: string) { const user = s.users.find(u => u.id === id); if (!user) throw new Error('계정을 찾을 수 없습니다.'); const a = ensure(s); a.userId = id; a.onboarded = true; s.activeUserId = id; s.mode = user.admin ? 'admin' : 'buyer'; }
export function endSession(s: State) { ensure(s).userId = null; s.activeUserId = ''; s.mode = 'buyer'; }
export function sendCode(s: State, emailValue: string, purpose: 'signup' | 'reset', now = Date.now()) {
  const email = normalizeEmail(emailValue); if (!validEmail(email)) throw new Error('올바른 이메일 주소를 입력해 주세요.');
  const a = ensure(s), key = `${purpose}:${email}`, old = a.challenges[key];
  if (old && now - old.sentAt < 30_000) throw new Error('인증번호는 30초 후 다시 요청할 수 있습니다.');
  if (purpose === 'signup' && s.users.some(u => normalizeEmail(u.email) === email)) throw new Error('이미 가입된 이메일입니다. 로그인해 주세요.');
  if (purpose === 'reset' && !s.users.some(u => normalizeEmail(u.email) === email)) throw new Error('이메일을 확인해 주세요. 등록된 계정만 재설정할 수 있습니다.');
  const n = crypto.getRandomValues(new Uint32Array(1))[0];
  a.challenges[key] = { email, purpose, code: String(100000 + n % 900000), sentAt: now, expiresAt: now + 180_000, attempts: 0, verified: false };
}
export function verifyCode(s: State, email: string, purpose: 'signup' | 'reset', code: string, now = Date.now()): string | null {
  const c = ensure(s).challenges[`${purpose}:${normalizeEmail(email)}`];
  if (!c || c.expiresAt <= now) return '인증번호가 만료되었어요. 다시 요청해 주세요.';
  if (c.attempts >= 5) return '입력 횟수를 초과했어요. 인증번호를 다시 요청해 주세요.';
  if (!/^\d{6}$/.test(code) || c.code !== code) { c.attempts++; return '인증번호가 일치하지 않습니다.'; }
  c.verified = true; return null;
}
function proof(s: State, email: string, purpose: 'signup' | 'reset') { const c = s.auth?.challenges[`${purpose}:${normalizeEmail(email)}`]; if (!c?.verified || c.expiresAt <= Date.now() || c.attempts >= 5) throw new Error('이메일 인증을 다시 진행해 주세요.'); return c; }
function base64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
async function hashPassword(password: string, salt: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']); const bytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0)); return base64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes, iterations: 120000 }, key, 256))); }
async function credential(password: string) { const salt = base64(crypto.getRandomValues(new Uint8Array(16))); return { salt, hash: await hashPassword(password, salt) }; }
export async function login(emailValue: string, password: string) {
  const email = normalizeEmail(emailValue), current = getState(), user = current.users.find(u => normalizeEmail(u.email) === email), a = current.auth;
  if ((a?.loginFailures[email]?.until ?? 0) > Date.now()) throw new Error('로그인 시도가 많습니다. 5분 후 다시 시도해 주세요.');
  const saved = user && a?.credentials[user.id];
  const valid = !!user && (saved ? await hashPassword(password, saved.salt) === saved.hash : ['buyer', 'seller', 'admin', 'applicant'].includes(user.id) && password === DEMO_PASSWORD);
  const seeded = valid && !saved ? await credential(password) : undefined;
  const result = await atomic(s => { const auth = ensure(s); if (auth.loginFailures[email]?.until > Date.now()) return '로그인 시도가 많습니다. 5분 후 다시 시도해 주세요.'; if (valid && user) { if (saved && JSON.stringify(auth.credentials[user.id]) !== JSON.stringify(saved)) return '계정 정보가 변경되었어요. 다시 로그인해 주세요.'; if (seeded && auth.credentials[user.id]) return '계정 정보가 변경되었어요. 다시 로그인해 주세요.'; if (seeded) auth.credentials[user.id] = seeded; delete auth.loginFailures[email]; selectProfile(s, user.id); return null; } const previous = auth.loginFailures[email]; const count = previous?.until && previous.until <= Date.now() ? 1 : (previous?.count ?? 0) + 1; auth.loginFailures[email] = { count, until: count >= 5 ? Date.now() + 300_000 : 0 }; return count >= 5 ? '로그인 시도가 많습니다. 5분 후 다시 시도해 주세요.' : '이메일 또는 비밀번호가 일치하지 않습니다.'; });
  if (result) throw new Error(result);
}
export async function signup(input: { email: string; password: string; name: string; phone: string; age: boolean; terms: boolean; privacy: boolean; marketing: boolean }) {
  if (!validPassword(input.password)) throw new Error('비밀번호는 영문·숫자·특수문자를 포함한 8~32자로 입력해 주세요.');
  if (!input.name.trim() || input.name.trim().length > 30 || !/^01[016789]\d{7,8}$/.test(input.phone.replace(/\D/g, ''))) throw new Error('이름과 올바른 휴대폰 번호를 입력해 주세요.');
  if (!input.age || !input.terms || !input.privacy) throw new Error('필수 약관에 동의해 주세요.');
  const cred = await credential(input.password);
  return atomic(s => { const email = normalizeEmail(input.email); proof(s, email, 'signup'); if (s.users.some(u => normalizeEmail(u.email) === email)) throw new Error('이미 가입된 이메일입니다.'); const id = uid('user-'); s.users.push({ id, name: input.name.trim(), phone: input.phone.replace(/\D/g, ''), email, seller: false, admin: false }); const auth = ensure(s); auth.credentials[id] = cred; auth.consents[id] = { acceptedAt: Date.now(), marketing: input.marketing }; delete auth.challenges[`signup:${email}`]; selectProfile(s, id); return id; });
}
export async function resetPassword(emailValue: string, password: string) { if (!validPassword(password)) throw new Error('영문·숫자·특수문자를 포함한 8~32자로 입력해 주세요.'); const cred = await credential(password); await atomic(s => { const email = normalizeEmail(emailValue); proof(s, email, 'reset'); const user = s.users.find(u => normalizeEmail(u.email) === email); if (!user) throw new Error('계정을 찾을 수 없습니다.'); const a = ensure(s); a.credentials[user.id] = cred; delete a.challenges[`reset:${email}`]; delete a.loginFailures[email]; if (a.userId === user.id) endSession(s); }); }
