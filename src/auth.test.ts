import { describe, expect, it, vi } from 'vitest';
// store.ts가 import 시점에 window·localStorage를 쓴다(node 환경에는 없음)
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
const sess = new Map<string, string>();
vi.stubGlobal('sessionStorage', { getItem: (k: string) => sess.get(k) ?? null, setItem: (k: string, v: string) => void sess.set(k, v), removeItem: (k: string) => void sess.delete(k) });
vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {}, localStorage });
const { sanitizeCode } = await import('./components/CodeInput');
const { api, ApiError } = await import('./api');
const { parseServerTime, sendCode, setPendingPrefs, flushPendingPrefs } = await import('./auth');

describe('인증번호 발송', () => {
  it('나노초 시각을 밀리초로 파싱한다', () => {
    expect(parseServerTime('2026-11-11T12:22:37.200089800Z')).toBe(Date.parse('2026-11-11T12:22:37.200Z'));
    expect(parseServerTime('2026-11-11T12:22:37Z')).toBe(Date.parse('2026-11-11T12:22:37Z'));
  });
  it('붙여넣기·입력값은 숫자 6자리만 남긴다', () => {
    expect(sanitizeCode('123 456')).toBe('123456');
    expect(sanitizeCode('12-34-56-78')).toBe('123456');
    expect(sanitizeCode('abc')).toBe('');
  });
  it('같은 이메일 중복 호출은 요청 1번', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ challengeId: 'c1', expiresAt: '2026-11-11T12:22:37.200089800Z', resendAvailableAt: '2026-11-11T12:18:37.200089800Z' });
    await Promise.all([sendCode('A@b.co', 'signup'), sendCode('a@b.co', 'signup')]);
    expect(post).toHaveBeenCalledTimes(1);
    post.mockRestore();
  });
  it('409는 code를 보존해 던진다', async () => {
    const post = vi.spyOn(api, 'post').mockRejectedValue(new ApiError('이미 가입된 이메일입니다.', 409, 'ACCOUNT_EMAIL_ALREADY_EXISTS'));
    await expect(sendCode('dup@b.co', 'signup')).rejects.toMatchObject({ code: 'ACCOUNT_EMAIL_ALREADY_EXISTS' });
    post.mockRestore();
  });
});

describe('가입 직후 설정 저장', () => {
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(status < 300 ? { success: true, data } : { code: 'AUTH', message: 'x' }), { status, headers: { 'content-type': 'application/json' } });
  it('로그인(토큰)이 없으면 보관만 하고, 로그인 뒤 한 번에 저장한다 (401 없이)', async () => {
    const calls: string[] = []; let loggedIn = false;
    api.configure({ mock: false, fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
      const url = String(u), auth = (init?.headers as Record<string, string>)?.Authorization; calls.push(`${init?.method ?? 'GET'} ${url.replace('/api', '')} ${auth ?? '-'}`);
      if (url.endsWith('/auth/csrf')) return json({ headerName: 'X-CSRF', token: 't' });
      if (url.endsWith('/auth/refresh')) return loggedIn ? json({ accessToken: 'tok', tokenType: 'Bearer', expiresAt: '', accountId: 'a', roles: [] }) : json(null, 401);
      return json(null);
    }) as typeof fetch });
    setPendingPrefs({ sale: true, recommend: false, marketing: false });
    expect(await flushPendingPrefs()).toBe(false); // 로그인 전: 저장 요청 없음, 보관 유지
    expect(calls.some(c => c.startsWith('PUT'))).toBe(false);
    loggedIn = true; api.setAccessToken('tok');
    expect(await flushPendingPrefs()).toBe(true);
    expect(calls.filter(c => c.startsWith('PUT')).every(c => c.endsWith('Bearer tok'))).toBe(true);
    expect(calls.filter(c => c.startsWith('PUT')).map(c => c.split(' ')[1])).toEqual(['/v1/accounts/me/notification-settings', '/v1/accounts/me/marketing-consent']);
    expect(await flushPendingPrefs()).toBe(true); expect(sess.size).toBe(0);
  });
});
