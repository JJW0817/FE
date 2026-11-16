/** API 응답 → 화면이 쓰는 기존 도메인 타입 변환. 화면 코드는 그대로 두고 여기서 모양을 맞춘다 */
import type { Address, Order, OrderStatus } from '../domain';
import type { DeliveryState, OrderAddressDto, OrderDetailDto, OrderState } from './types';

/** 서버 시각은 나노초(.200089800Z)까지 온다 — 밀리초 3자리로 잘라 파싱한다(Safari 호환). 못 읽으면 NaN */
export const parseServerTime = (v: string) => new Date(v.replace(/(\.\d{3})\d+/, '$1')).getTime();
/** 서버 시각 → ms. 없거나 못 읽으면 undefined (0으로 바꾸지 않는다: 1970년이 되어 즉시 만료로 보인다) */
export const ms = (iso?: string | null): number | undefined => { const t = iso ? parseServerTime(iso) : NaN; return Number.isFinite(t) ? t : undefined; };

export function rolesToFlags(roles: readonly string[]) {
  const has = (role: string) => roles.some(r => r.toUpperCase() === role);
  return { seller: has('SELLER'), admin: has('ADMIN') };
}
/** 로그인 직후 시작 화면: 운영자 → /admin, 판매자 → /seller, 그 외 홈 (역할 선택 데모 로그인과 같은 규칙) */
export const homePathFor = (flags: { seller: boolean; admin: boolean }) => (flags.admin ? '/admin' : '/');

/** 주문 상태(state)+배송(delivery) → 화면 OrderStatus. 구매 완료는 CONFIRMED에서만 */
export function orderStatus(state: OrderState, delivery: DeliveryState | null): OrderStatus {
  if (state === 'CONFIRMED') return delivery === 'SHIPPING' ? 'shipping' : delivery === 'DELIVERED' ? 'delivered' : delivery === 'PREPARING' ? 'preparing' : 'paid';
  return state === 'FAILED' || state === 'EXPIRED' ? 'cancelled' : 'paid';
}

export function addressFromApi(a: OrderAddressDto): Address {
  return { name: a.recipientName, phone: a.recipientPhone, address: a.roadAddress, detail: a.detailAddress ?? '', request: a.deliveryMemo ?? '', postalCode: a.postalCode };
}

export function orderFromApi(d: OrderDetailDto, userId: string, image = ''): Order {
  return {
    id: d.orderId, userId, sellerId: '', productId: d.productId, holdId: d.orderId,
    lines: (d.items ?? []).map(i => ({ optionId: i.optionId, name: i.label ?? '', quantity: i.quantity })),
    product: { name: d.productName ?? '', brand: d.brandOrStore ?? '', image, category: '', originalUrl: '', price: d.unitPrice ?? 0 },
    shipping: d.shippingFee ?? 0, total: d.totalAmount ?? 0,
    address: d.address ? addressFromApi(d.address) : { name: '', phone: '', address: '', detail: '', request: '' },
    status: orderStatus(d.state, d.delivery), createdAt: Date.parse(d.createdAt),
    carrier: d.carrier ?? undefined, tracking: d.trackingNumber ?? undefined, shippedAt: ms(d.shippedAt), deliveredAt: ms(d.deliveredAt),
  };
}
