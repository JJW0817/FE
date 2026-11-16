import { describe, expect, it } from 'vitest';
import { homePathFor, orderFromApi, orderStatus, rolesToFlags } from './mappers';
import type { OrderDetailDto } from './types';

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
