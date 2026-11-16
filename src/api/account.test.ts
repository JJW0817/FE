import { afterEach, describe, expect, it } from 'vitest';
import { api } from './client';
import { fetchMySettings, fetchWithdrawalEligibility, saveMarketingConsent, saveNotificationSettings, updateMyName, withdrawAccount } from './account';
import { fetchUnreadCount, listNotifications, markAllNotificationsRead, markNotificationRead, notificationFromApi, notificationPath } from './notifications';
import type { NotificationDto } from './types';

type Call = { url: string; method: string; body: unknown };
function fake(handler: (c: Call) => unknown) {
  const calls: Call[] = [];
  api.configure({ mock: false, fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
    const c = { url: String(u), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined }; calls.push(c);
    return new Response(JSON.stringify({ success: true, code: 'COMMON_SUCCESS', message: '', data: handler(c) }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch });
  return calls;
}
afterEach(() => { api.configure({ fetch: undefined }); });
const path = (c: Call) => c.method + ' ' + c.url.split('/v1')[1];
const me = { accountId: 'a', email: 'e', name: '홍', roles: ['BUYER'], notificationSettings: { saleStart: true, personalizedRecommendation: false }, marketingConsent: { agreed: true, agreedAt: null, withdrawnAt: null, updatedAt: 'x' } };

describe('회원 설정 API', () => {
  it('내 정보: 동의는 agreed로', async () => {
    const calls = fake(() => me);
    expect(await fetchMySettings()).toEqual({ name: '홍', saleStart: true, personalizedRecommendation: false, marketing: true });
    expect(calls.map(path).sort()).toEqual(['GET /accounts/me']);
  });
  it('이름·동의·알림 설정·탈퇴 가능 여부·탈퇴', async () => {
    const calls = fake(() => null);
    await updateMyName('새'); await saveMarketingConsent(true); await saveNotificationSettings(true, false); await fetchWithdrawalEligibility(); await withdrawAccount('pw', '');
    expect(calls.map(path)).toEqual(['PATCH /accounts/me', 'PUT /accounts/me/marketing-consent', 'PUT /accounts/me/notification-settings', 'GET /accounts/me/withdrawal-eligibility', 'DELETE /accounts/me']);
    expect(calls.map(c => c.body)).toEqual([{ name: '새' }, { marketingConsent: true }, { saleStart: true, personalizedRecommendation: false }, undefined, { currentPassword: 'pw', confirmed: true }]);
  });
});

describe('알림함 API', () => {
  const dto: NotificationDto = { id: 'n1', type: 'PERSONALIZED_PRODUCT', title: 't', body: 'b', targetType: 'PRODUCT', targetId: 'p 1', relatedId: null, deadline: null, occurredAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', readAt: null };
  it('변환·경로', () => {
    expect(notificationFromApi(dto)).toMatchObject({ kind: '맞춤 추천', read: false, desc: 'b' });
    expect(notificationFromApi({ ...dto, type: 'X', targetType: 'ORDER', readAt: 'x' })).toMatchObject({ kind: '구매', read: true });
    expect(notificationPath({ targetType: 'PRODUCT', targetId: 'p 1' })).toBe('/product/p%201');
    expect(['SELLER_ORDER', 'SELLER_PRODUCT', 'SELLER_APPLICATION'].map(t => notificationPath({ targetType: t as never, targetId: 'i' }))).toEqual(['/seller/orders/i', '/seller/product/i', '/apply']);
  });
  it('목록·개수·읽음 호출', async () => {
    const calls = fake(c => (c.url.endsWith('unread-count') ? { count: 3 } : c.method === 'PATCH' ? { changed: 1 } : { content: [dto], page: 0, size: 50, totalElements: 1 }));
    expect(await listNotifications()).toHaveLength(1); expect(await fetchUnreadCount()).toBe(3);
    await markNotificationRead('n1'); await markAllNotificationsRead();
    expect(calls.map(path)).toEqual(['GET /notifications?page=0&size=50', 'GET /notifications/unread-count', 'PATCH /notifications/n1/read', 'PATCH /notifications/read-all']);
  });
});
