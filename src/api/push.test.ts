import { afterEach, describe, expect, it } from 'vitest';
import { api } from './client';
import { deletePushSubscription, getPushConfiguration, listPushSubscriptions, registerPushSubscription, vapidKeyBytes } from './push';

type Call = { url: string; method: string; body: unknown };
function fake(data: unknown) {
  const calls: Call[] = [];
  api.configure({ mock: false, fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(u), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify({ success: true, code: 'COMMON_SUCCESS', message: '', data }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch });
  return calls;
}
afterEach(() => api.configure({ fetch: undefined }));

describe('웹 푸시 API', () => {
  it('설정·목록 조회 경로', async () => {
    let calls = fake({ enabled: true, publicKey: 'k' });
    expect(await getPushConfiguration()).toEqual({ enabled: true, publicKey: 'k' });
    expect(calls[0]).toMatchObject({ method: 'GET' }); expect(calls[0].url).toMatch(/\/api\/v1\/notifications\/push-configuration$/);
    calls = fake([]);
    await listPushSubscriptions(); expect(calls[0].url).toMatch(/\/v1\/notifications\/push-subscriptions$/);
  });
  it('등록: toJSON 형식 그대로, expirationTime이 null이면 생략', async () => {
    const calls = fake({ id: 's1', active: true, expiresAt: null, createdAt: 'x' });
    const saved = await registerPushSubscription({ endpoint: 'https://web.push.apple.com/abc', expirationTime: null, keys: { p256dh: 'p', auth: 'a' } });
    expect(saved.id).toBe('s1');
    expect(calls[0]).toMatchObject({ method: 'POST', body: { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p', auth: 'a' } } });
    expect(calls[0].body).not.toHaveProperty('expirationTime');
  });
  it('해제: DELETE /push-subscriptions/{id}', async () => {
    const calls = fake(null);
    await deletePushSubscription('s 1');
    expect(calls[0]).toMatchObject({ method: 'DELETE' }); expect(calls[0].url).toMatch(/push-subscriptions\/s%201$/);
  });
  it('VAPID 키 Base64URL 디코딩', () => {
    expect(Array.from(vapidKeyBytes('BAEC_-8'))).toEqual([0x04, 0x01, 0x02, 0xff, 0xef]);
  });
});
