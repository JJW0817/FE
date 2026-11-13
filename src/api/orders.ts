/**
 * 주문·결제 도메인(구매자) — 명세 docs/api-spec.md 4절 중 주문/결제 API만. 주문 문의·문의 이미지는 '문의' 도메인.
 * 조회(목록·상세)·결제 설정=일반 Gateway(`general`), 쓰기·결제용 원본(checkout·약관)=PurchaseGateway(`purchase`).
 * 화면은 Hold(결제 대기)·Order(확정 주문) 타입을 그대로 쓰므로 여기서 변환해 store에 넣는다. 구매 완료는 CONFIRMED에서만.
 * 취소·환불·반품 API는 명세에 없다 → 화면의 기존 로컬 동작 유지 (TODO(api-gap)).
 */
import type { Hold, Order, State } from '../domain';
import { api } from './client';
import { orderStatus, addressFromApi, orderFromApi } from './mappers';
import type { CheckoutTermsDto, OrderCommandDto, OrderItemDto, OrderListItemDto, OrderDetailDto, OrderState } from './types';

const general = 'general' as const, purchase = 'purchase' as const;
const enc = encodeURIComponent;

/* ── 변환 ── */
const lines = (items: OrderItemDto[]) => items.map(i => ({ optionId: i.optionId, name: i.label ?? '', quantity: i.quantity }));
/** 결제 대기(HELD) → reserved, 결제 진행·검증 중 → pending, 확정 → consumed, 실패·만료 → released */
const IN_PROGRESS: OrderState[] = ['RESERVING', 'STARTING_PAYMENT', 'APPROVING_PAYMENT', 'VERIFYING_PAYMENT', 'CONFIRMING_STOCK', 'COMPENSATING_PAYMENT', 'RELEASING_STOCK'];
export const holdStatus = (st: OrderState): Hold['status'] => (st === 'HELD' ? 'reserved' : st === 'CONFIRMED' ? 'consumed' : IN_PROGRESS.includes(st) ? 'pending' : 'released');
/** 서버 시각 기준 만료 시각을 이 기기 시계 기준 ms로 바꾼다 (기기 시계가 틀려도 5분 카운터가 맞게) */
export function expiresLocal(expiresAt: string | null, serverTime: string) {
  return expiresAt ? Date.parse(expiresAt) - (Date.parse(serverTime) - Date.now()) : 0;
}
/** 주문 생성·checkout·배송지 변경 응답 → Hold */
export function holdFromApi(d: OrderCommandDto, userId: string): Hold {
  return { id: d.orderId, userId, productId: d.productId ?? '', lines: lines(d.items), createdAt: d.expiresAt ? expiresLocal(d.expiresAt, d.serverTime) - 300_000 : Date.now(), expiresAt: expiresLocal(d.expiresAt, d.serverTime), status: holdStatus(d.state), orderId: d.state === 'CONFIRMED' ? d.orderId : undefined };
}
/** 확정된 checkout 응답 → Order (조회 모델 반영 전에도 완료 화면을 보여 주기 위해) */
export function orderFromCommand(d: OrderCommandDto, userId: string): Order {
  return {
    id: d.orderId, userId, sellerId: d.sellerId ?? '', productId: d.productId ?? '', holdId: d.orderId, lines: lines(d.items),
    product: { name: d.productName ?? '', brand: d.brandOrStore ?? '', image: '', category: '', originalUrl: '', price: d.unitPrice ?? 0 },
    shipping: d.shippingFee ?? 0, total: d.totalAmount ?? 0,
    address: d.address ? addressFromApi(d.address) : { name: '', phone: '', address: '', detail: '', request: '' },
    status: orderStatus(d.state, d.delivery), createdAt: d.confirmedAt ? Date.parse(d.confirmedAt) : Date.now(), carrier: d.carrier ?? undefined, tracking: d.trackingNumber ?? undefined,
  };
}
/** 목록 항목 → Order. 목록에는 단가·배송비·배송지가 없어 0/빈 값 (상세를 이미 받았다면 merge가 유지) */
export function orderFromListItem(d: OrderListItemDto, userId: string): Order {
  return {
    id: d.orderId, userId, sellerId: '', productId: d.productId, holdId: d.orderId, lines: lines(d.items),
    product: { name: d.productName, brand: d.brandOrStore, image: '', category: '', originalUrl: '', price: 0 },
    shipping: 0, total: d.totalAmount, address: { name: '', phone: '', address: '', detail: '', request: '' }, status: orderStatus(d.state, d.delivery), createdAt: Date.parse(d.createdAt),
  };
}

/* ── API ── */
export interface OrderListQuery { keyword?: string; state?: OrderState; page?: number; size?: number }
/** GET /v1/orders — 본인 주문 목록. 응답 목록 필드는 `content`(상품의 items와 다름) */
export async function listOrders(q: OrderListQuery = {}, signal?: AbortSignal): Promise<OrderListItemDto[]> {
  return (await api.get<{ content: OrderListItemDto[] }>('/v1/orders', { service: general, signal, query: { size: 100, ...q } })).content;
}
/** GET /v1/orders/{id} — 주문 상세. 조회 모델 반영 지연으로 막 결제한 주문은 404일 수 있다 */
export async function getOrder(id: string, userId: string, signal?: AbortSignal): Promise<Order> {
  return orderFromApi(await api.get<OrderDetailDto>(`/v1/orders/${enc(id)}`, { service: general, signal }), userId);
}
/** POST /v1/orders — 주문 생성·재고 확보 (202 접수). requestKey가 같으면 같은 주문을 돌려준다 */
export function createOrder(b: { productId: string; items: { optionId: string; quantity: number }[]; addressId: string; requestKey?: string }): Promise<OrderCommandDto> {
  return api.post<OrderCommandDto>('/v1/orders', { requestKey: crypto.randomUUID(), ...b }, { service: purchase });
}
/** GET /v1/orders/{id}/checkout — 결제 화면 진입·새로고침·결과 확인 (Command 원본) */
export const getCheckout = (id: string, signal?: AbortSignal) => api.get<OrderCommandDto>(`/v1/orders/${enc(id)}/checkout`, { service: purchase, signal });
/** GET /v1/orders/checkout-terms — 현재 결제 약관. 결제 요청 시 version을 그대로 보낸다 */
export const getCheckoutTerms = (signal?: AbortSignal) => api.get<CheckoutTermsDto>('/v1/orders/checkout-terms', { service: purchase, signal });
/** GET /v1/orders/checkout-terms/{version} — 지정 버전 약관 (checkout.termsVersion과 다를 때) */
export const getCheckoutTermsVersion = (version: string, signal?: AbortSignal) => api.get<CheckoutTermsDto>(`/v1/orders/checkout-terms/${enc(version)}`, { service: purchase, signal });
/** GET /v1/payments/client-configuration — 토스 결제창 공개 clientKey */
export const getPaymentClientKey = async (signal?: AbortSignal) => (await api.get<{ clientKey: string }>('/v1/payments/client-configuration', { service: general, signal })).clientKey;
/** POST /v1/orders/{id}/payment-attempts — 토스 인증 후 paymentKey로 승인 요청 (202는 성공이 아님 → checkout 재조회) */
export function requestPayment(id: string, b: { paymentKey: string; termsVersion: string }): Promise<OrderCommandDto> {
  return api.post<OrderCommandDto>(`/v1/orders/${enc(id)}/payment-attempts`, { requestKey: crypto.randomUUID(), agreed: true, ...b }, { service: purchase });
}
/** PATCH /v1/orders/{id}/shipping-address — 결제 전 배송지 변경 (직전 checkout의 version 필요) */
export const changeShippingAddress = (id: string, addressId: string, expectedVersion: number) =>
  api.patch<OrderCommandDto>(`/v1/orders/${enc(id)}/shipping-address`, { addressId, expectedVersion }, { service: purchase });

/* ── 토스 결제창 ── */
/**
 * 서버가 정해 주는 것: clientKey(GET /payments/client-configuration)와 승인 금액(주문의 totalAmount — 승인 요청에는 금액을 보내지 않는다).
 * 명세가 정하지 않아 여기서만 고정하는 값(추측): SDK 버전·redirect 방식·결제 수단·고객 키. 바꿀 일이 생기면 이 상수만 고친다.
 */
const TOSS = {
  sdk: 'https://js.tosspayments.com/v2/standard',
  method: 'CARD' as const,
  currency: 'KRW' as const,
  // 추측(명세 없음): 비회원 결제 키(ANONYMOUS) — 저장된 카드·간편결제 없이 결제창이 열린다
  customerKey: (Toss: any) => Toss.ANONYMOUS as string,
};
function loadToss(): Promise<any> {
  const w = window as any;
  if (w.TossPayments) return Promise.resolve(w.TossPayments);
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = TOSS.sdk; s.onload = () => res(w.TossPayments); s.onerror = () => rej(new Error('결제창을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')); document.head.appendChild(s);
  });
}
/** 결제창을 연다. 성공/실패 시 successUrl/failUrl로 이동한다(HashRouter 경로: `#/checkout/{id}`). 반환하지 않고 페이지가 이동한다 */
/** amount·orderName은 서버의 checkout 응답(totalAmount·productName) 값을 그대로 넘긴다 */
export async function openTossPayment(o: { orderId: string; orderName: string; amount: number }, signal?: AbortSignal) {
  const [Toss, clientKey] = await Promise.all([loadToss(), getPaymentClientKey(signal)]);
  const base = `${location.origin}${location.pathname}#/checkout/${enc(o.orderId)}`;
  // 추측(명세 없음): 토스 orderId는 우리 주문 UUID(36자, 토스 허용 6~64자)를 쓴다
  await Toss(clientKey).payment({ customerKey: TOSS.customerKey(Toss) }).requestPayment({
    method: TOSS.method, amount: { currency: TOSS.currency, value: o.amount }, orderId: o.orderId, orderName: o.orderName, successUrl: base, failUrl: `${base}?payFail=1`,
  });
}
const FINAL: OrderState[] = ['CONFIRMED', 'FAILED', 'EXPIRED'];
const sleep = (t: number) => new Promise(r => setTimeout(r, t));
/** 결제 승인 요청 후 checkout을 폴링해 최종 상태(CONFIRMED/FAILED/EXPIRED)를 돌려준다. 추측(명세 없음): 2초 간격 최대 20회, 못 정하면 마지막 상태 */
export async function confirmPayment(id: string, b: { paymentKey: string; termsVersion: string }, onUpdate: (d: OrderCommandDto) => void): Promise<OrderCommandDto> {
  let d = await requestPayment(id, b); onUpdate(d);
  for (let i = 0; i < 20 && !FINAL.includes(d.state); i++) { await sleep(2000); d = await getCheckout(id); onUpdate(d); }
  return d;
}

/* ── store 반영 ── */
const emptyAddr = (o: Order) => !o.address.address;
/** checkout 응답을 hold로, 확정이면 주문으로도 넣는다 */
export function mergeCheckout(s: State, d: OrderCommandDto) {
  const h = holdFromApi(d, s.activeUserId); const i = s.holds.findIndex(x => x.id === h.id);
  if (i < 0) s.holds.push(h); else s.holds[i] = { ...h, productId: h.productId || s.holds[i].productId, lines: h.lines.length ? h.lines : s.holds[i].lines, createdAt: s.holds[i].createdAt };
  if (d.state === 'CONFIRMED') mergeOrders(s, [orderFromCommand(d, s.activeUserId)]);
}
/** 주문(확정)을 store에 넣는다. 상세로 이미 받은 단가·배송지는 목록 요약이 지우지 않게 유지, 이미지는 상품에서 */
export function mergeOrders(s: State, items: Order[]) {
  for (const n of items) {
    const old = s.orders.find(x => x.id === n.id);
    const img = s.products.find(p => p.id === n.productId)?.images[0] ?? '';
    const merged: Order = old ? { ...old, ...n, sellerId: n.sellerId || old.sellerId, product: { ...old.product, ...n.product, price: n.product.price || old.product.price, image: n.product.image || old.product.image || img }, shipping: n.shipping || old.shipping, address: emptyAddr(n) ? old.address : n.address } : { ...n, product: { ...n.product, image: img } };
    if (old) s.orders[s.orders.indexOf(old)] = merged; else s.orders.push(merged);
  }
}
/** 목록 응답 반영: CONFIRMED만 주문으로 (구매 완료는 CONFIRMED뿐). 결제 대기 카드는 목록에 expiresAt이 없어 만들지 않는다 */
export function mergeOrderList(s: State, items: OrderListItemDto[]) {
  mergeOrders(s, items.filter(d => d.state === 'CONFIRMED').map(d => orderFromListItem(d, s.activeUserId)));
}
