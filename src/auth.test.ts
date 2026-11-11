import { describe, expect, it, vi } from 'vitest';
// store.ts가 import 시점에 window·localStorage를 쓴다(node 환경에는 없음)
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {}, localStorage });
const { sanitizeCode } = await import('./components/CodeInput');
const { api, ApiError } = await import('./api');
const { parseServerTime, sendCode } = await import('./auth');

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
