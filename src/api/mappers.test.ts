import { describe, expect, it } from 'vitest';
import { homePathFor, orderFromApi, orderStatus, productFromApi, rolesToFlags } from './mappers';
import type { OrderDetailDto, ProductDetailDto } from './types';

describe('역할·시작 화면', () => {
  it('roles → seller/admin 플래그, 시작 화면', () => {
    expect(rolesToFlags(['BUYER'])).toEqual({ seller: false, admin: false });
    expect(rolesToFlags(['BUYER', 'SELLER'])).toEqual({ seller: true, admin: false });
    expect(rolesToFlags(['admin'])).toEqual({ seller: false, admin: true });
    expect(homePathFor(rolesToFlags(['ADMIN']))).toBe('/admin');
    expect(homePathFor(rolesToFlags(['BUYER', 'SELLER']))).toBe('/seller');
    expect(homePathFor(rolesToFlags(['BUYER']))).toBe('/');
  });
});

describe('주문 상태 변환', () => {
  it('구매 완료는 CONFIRMED에서만, 배송 상태로 세분화한다', () => {
    expect(orderStatus('CONFIRMED', 'PREPARING')).toBe('preparing');
    expect(orderStatus('CONFIRMED', 'SHIPPING')).toBe('shipping');
    expect(orderStatus('CONFIRMED', 'DELIVERED')).toBe('delivered');
    expect(orderStatus('CONFIRMED', null)).toBe('paid');
    expect(orderStatus('FAILED', null)).toBe('cancelled');
    expect(orderStatus('EXPIRED', null)).toBe('cancelled');
  });
});

const detail: ProductDetailDto = {
  id: 'p1', sellerId: 's1', name: '테스트 상품', description: '설명', brandOrStore: '테스트 스토어', category: '의류', sourceUrl: 'https://store.example.invalid/p', price: 10000, shippingFee: 3000,
  dispatchBusinessDays: 3, perAccountLimit: 2, shippingNotice: null, purchaseNotice: null, disposalReason: '시즌 종료', attributes: [{ name: '소재', value: '면 100%' }], dimensions: [{ name: '색상', values: ['크림', '네이비'] }],
  options: [{ id: 'o1', label: '크림', selections: { 색상: '크림' }, availableQuantity: 7 }],
  images: [{ id: 'i2', objectKey: 'k2', url: 'https://img/2', contentType: 'image/png', position: 1, representative: false }, { id: 'i1', objectKey: 'k1', url: 'https://img/1', contentType: 'image/png', position: 0, representative: true }, { id: 'i3', objectKey: 'k3', url: null, contentType: 'image/png', position: 2, representative: false }],
  faqs: [{ id: 'f1', question: 'Q', answer: 'A', confirmedAt: '2029-12-01T00:00:00Z' }], canAttemptPurchase: true, serverTime: '2030-01-01T01:00:00Z',
  status: 'SOLD_OUT', startsAt: '2030-01-01T01:00:00Z', endsAt: '2030-01-01T04:00:00Z', soldOutAt: '2030-01-01T01:23:00Z',
  stock: { initialQuantity: 10, confirmedQuantity: 10, availableQuantity: 0, approximate: true }, metadata: { version: 1, occurredAt: '2030-01-01T00:59:58Z', projectedAt: '2030-01-01T00:59:59Z' },
};
describe('공개 상품 → Product', () => {
  it('화면이 쓰는 형태로 변환한다 (이미지 정렬·URL 없는 이미지 제외, 시각은 ms)', () => {
    const p = productFromApi(detail);
    expect(p).toMatchObject({ id: 'p1', brand: '테스트 스토어', originalUrl: 'https://store.example.invalid/p', shipping: 3000, maxPerAccount: 2, dispatchDays: 3, reason: '시즌 종료', published: true });
    expect(p.images).toEqual(['https://img/1', 'https://img/2']);
    expect(p.options).toEqual([{ id: 'o1', name: '크림', stock: 7 }]);
    expect(p.dimensions).toEqual([{ name: '색상', values: '크림, 네이비' }]);
    expect(p.extras).toEqual([{ key: '소재', value: '면 100%' }]);
    expect(p.startsAt).toBe(Date.parse('2030-01-01T01:00:00Z'));
    expect(p.soldOutAt).toBe(Date.parse('2030-01-01T01:23:00Z'));
    expect(productFromApi({ ...detail, soldOutAt: null }).soldOutAt).toBeUndefined();
  });
});

describe('주문 상세 → Order', () => {
  it('상태·배송지·송장을 옮기고 null은 빈 값으로', () => {
    const dto: OrderDetailDto = { orderId: 'o1', orderNumber: 'SD-1', productId: 'p1', productName: '테스트 상품', brandOrStore: '스토어', items: [{ optionId: 'op', label: '크림', quantity: 2 }], state: 'CONFIRMED', delivery: 'SHIPPING',
      address: { recipientName: '수령인', recipientPhone: '01000000000', postalCode: '04524', roadAddress: '도로 1', detailAddress: null, deliveryMemo: null }, unitPrice: 10000, shippingFee: 3000, totalAmount: 23000, dispatchBusinessDays: 3,
      expiresAt: null, createdAt: '2030-01-01T01:00:00Z', confirmedAt: '2030-01-01T01:04:00Z', carrier: '택배', trackingNumber: 'T-1', shippedAt: '2030-01-02T00:00:00Z', deliveredAt: null, sourceVersion: 7 };
    const o = orderFromApi(dto, 'me');
    expect(o).toMatchObject({ id: 'o1', userId: 'me', status: 'shipping', total: 23000, shipping: 3000, carrier: '택배', tracking: 'T-1', lines: [{ optionId: 'op', name: '크림', quantity: 2 }] });
    expect(o.address).toEqual({ name: '수령인', phone: '01000000000', address: '도로 1', detail: '', request: '', postalCode: '04524' });
    expect(o.deliveredAt).toBeUndefined();
  });
});
