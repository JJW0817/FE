import { afterEach, describe, expect, it } from 'vitest';
import { api } from './client';
import { SERVICE_BASE } from './services';
import { createOrder, getCheckout, getPaymentClientKey, listOrders } from './orders';
import { registerShipment } from './sellerOrders';
import { listSellerProducts } from './sellerProducts';
import { listAdminApplications, listAdminProductReviews } from './admin';
import { fetchMySettings } from './account';
import { listNotifications } from './notifications';
import { getPushConfiguration } from './push';

/** 호출한 URL만 본다. 응답 변환 오류는 무시한다 */
async function urlOf(fn: () => Promise<unknown>) {
  const urls: string[] = [];
  api.configure({ mock: false, fetch: (async (u: RequestInfo | URL) => { urls.push(String(u)); return new Response(JSON.stringify({ success: true, code: 'OK', message: '', data: {} }), { status: 200, headers: { 'content-type': 'application/json' } }); }) as typeof fetch });
  await fn().catch(() => {});
  return urls[0];
}
afterEach(() => api.configure({ fetch: undefined }));

describe('서비스별 주소 (Gateway /api, PurchaseGateway /pg/api)', () => {
  it('기본 주소는 모두 상대 경로다', () => {
    expect(SERVICE_BASE).toEqual({ account: '/api', general: '/api', purchase: '/pg/api' });
  });
  it('Gateway(/api): 인증·계정·상품/주문 조회·알림·결제 설정·운영자 입점 심사', async () => {
    expect(await urlOf(() => api.get('/v1/auth/csrf', { auth: false }))).toBe('/api/v1/auth/csrf');
    expect(await urlOf(() => fetchMySettings())).toMatch(/^\/api\/v1\/accounts\/me/);
    expect(await urlOf(() => listOrders())).toMatch(/^\/api\/v1\/orders/);
    expect(await urlOf(() => getPaymentClientKey())).toBe('/api/v1/payments/client-configuration');
    expect(await urlOf(() => listNotifications())).toMatch(/^\/api\/v1\/notifications/);
    expect(await urlOf(() => getPushConfiguration())).toBe('/api/v1/notifications/push-configuration');
    expect(await urlOf(() => listAdminApplications())).toMatch(/^\/api\/v1\/admin\/seller-applications/);
  });
  it('PurchaseGateway(/pg/api): 주문 생성·체크아웃·배송 처리·판매자 상품·운영자 상품 심사', async () => {
    expect(await urlOf(() => createOrder({ productId: 'p', items: [{ optionId: 'o', quantity: 1 }], addressId: 'a' }))).toBe('/pg/api/v1/orders');
    expect(await urlOf(() => getCheckout('o1'))).toBe('/pg/api/v1/orders/o1/checkout');
    expect(await urlOf(() => registerShipment('o1', { carrier: 'c', trackingNumber: 't', expectedVersion: 1 }))).toBe('/pg/api/v1/seller/orders/o1/shipment');
    expect(await urlOf(() => listSellerProducts('s'))).toMatch(/^\/pg\/api\/v1\/seller\/products/);
    expect(await urlOf(() => listAdminProductReviews())).toMatch(/^\/pg\/api\/v1\/admin\/product-reviews/);
  });
});
