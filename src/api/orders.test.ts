import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client';
import { changeShippingAddress, createOrder, getCheckout, getCheckoutTerms, getOrder, getPaymentClientKey, holdFromApi, holdStatus, listOrders, mergeCheckout, mergeOrderList, orderFromCommand, requestPayment, retryWhileUnavailable } from './orders';
import { emptyState } from '../domain';
import type { OrderCommandDto, OrderListItemDto } from './types';

const cmd = (o: Partial<OrderCommandDto> = {}): OrderCommandDto => ({
  orderId: 'o1', orderNumber: 'N1', version: 3, state: 'HELD', delivery: null, productId: 'p1', sellerId: 's1', productName: '상품', brandOrStore: '스토어',
  items: [{ optionId: 'op1', label: '크림', quantity: 2 }], address: { recipientName: '홍', recipientPhone: '010', postalCode: '1', roadAddress: '도로', detailAddress: null, deliveryMemo: null },
  unitPrice: 1000, shippingFee: 3000, totalAmount: 5000, dispatchBusinessDays: 3, expiresAt: '2030-01-01T00:05:00Z', serverTime: '2030-01-01T00:00:00Z', paymentAttemptId: null, confirmedAt: null, carrier: null, trackingNumber: null, failureCode: null, termsVersion: null, ...o,
});
const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, code: 'COMMON_SUCCESS', message: '', data }), { status, headers: { 'content-type': 'application/json' } });
type Call = { url: string; method: string; body?: any };
function fake(handler: (c: Call) => Response) { const calls: Call[] = []; api.configure({ mock: false, fetch: (async (u: RequestInfo | URL, init?: RequestInit) => { const c = { url: String(u), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined }; calls.push(c); return handler(c); }) as typeof fetch }); return calls; }
afterEach(() => { vi.useRealTimers(); api.configure({ fetch: undefined }); });

describe('변환', () => {
  it('state → hold 상태 (HELD만 결제 가능, CONFIRMED만 완료)', () => {
    expect(holdStatus('HELD')).toBe('reserved'); expect(holdStatus('VERIFYING_PAYMENT')).toBe('pending'); expect(holdStatus('RESERVING')).toBe('pending');
    expect(holdStatus('CONFIRMED')).toBe('consumed'); expect(holdStatus('FAILED')).toBe('released'); expect(holdStatus('EXPIRED')).toBe('released');
  });
  it('만료 시각은 서버 시각 차이를 보정한다', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01T00:01:00Z')); // 시계 고정
    const h = holdFromApi(cmd({ serverTime: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() - 60_000 + 300_000).toISOString() }), 'u');
    expect(h.expiresAt).toBe(Date.now() + 300_000);
    expect(h.lines).toEqual([{ optionId: 'op1', name: '크림', quantity: 2 }]);
  });
  it('expiresAt이 null이면 만료 시각을 0(1970년)으로 만들지 않고, 이미 받은 시각을 지우지 않는다', () => {
    const h = holdFromApi(cmd({ state: 'RESERVING', expiresAt: null }), 'u');
    expect(h.expiresAt).toBeUndefined(); expect(h.createdAt).toBeUndefined(); expect(h.status).toBe('pending');
    expect(holdFromApi(cmd({ expiresAt: 'not-a-date' }), 'u').expiresAt).toBeUndefined();
    const s = emptyState(); mergeCheckout(s, cmd()); const first = s.holds[0].expiresAt;
    mergeCheckout(s, cmd({ expiresAt: null })); expect(s.holds[0].expiresAt).toBe(first);
  });
  it('나노초 시각(.200089800Z)도 읽는다', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01T00:00:00.200Z'));
    const h = holdFromApi(cmd({ serverTime: '2030-01-01T00:00:00.200089800Z', expiresAt: '2030-01-01T00:05:00.200999999Z' }), 'u');
    expect(h.expiresAt).toBe(Date.parse('2030-01-01T00:05:00.200Z'));
  });
  it('FAILED는 만료가 아니라 실패 코드로 남는다', () => {
    const h = holdFromApi(cmd({ state: 'FAILED', expiresAt: null, failureCode: 'PRODUCT_DUPLICATE' }), 'u');
    expect(h).toMatchObject({ status: 'released', failureCode: 'PRODUCT_DUPLICATE' }); expect(h.expiresAt).toBeUndefined();
    expect(holdFromApi(cmd({ state: 'FAILED', failureCode: null }), 'u').failureCode).toBe('UNKNOWN');
    expect(holdFromApi(cmd({ state: 'EXPIRED' }), 'u').failureCode).toBeUndefined();
  });
  it('확정 checkout은 주문으로도 들어가고, 미확정은 주문이 되지 않는다', () => {
    const s = emptyState(); mergeCheckout(s, cmd());
    expect(s.holds).toHaveLength(1); expect(s.orders).toHaveLength(0);
    mergeCheckout(s, cmd({ state: 'CONFIRMED', delivery: 'PREPARING', confirmedAt: '2030-01-01T00:01:00Z' }));
    expect(s.holds[0]).toMatchObject({ status: 'consumed', orderId: 'o1' }); expect(s.orders[0]).toMatchObject({ id: 'o1', status: 'preparing', total: 5000, shipping: 3000 });
    expect(orderFromCommand(cmd({ state: 'FAILED' }), 'u').status).toBe('cancelled');
  });
  it('목록은 CONFIRMED만 주문으로, 상세로 받은 단가는 유지한다', () => {
    const item = (orderId: string, state: OrderListItemDto['state']): OrderListItemDto => ({ orderId, orderNumber: 'n', productId: 'p1', productName: '상품', brandOrStore: '스토어', items: [], state, delivery: null, totalAmount: 5000, createdAt: '2030-01-01T00:00:00Z', sourceVersion: 1 });
    const s = emptyState(); mergeCheckout(s, cmd({ state: 'CONFIRMED' }));
    mergeOrderList(s, [item('o1', 'CONFIRMED'), item('o2', 'HELD'), item('o3', 'FAILED')]);
    expect(s.orders.map(o => o.id)).toEqual(['o1']); expect(s.orders[0].product.price).toBe(1000);
  });
});

describe('API 호출', () => {
  it('목록·상세는 일반 Gateway, content 필드', async () => {
    const calls = fake(c => ok(c.url.endsWith('/v1/orders?size=100') ? { content: [] } : { orderId: 'o1', orderNumber: 'n', productId: 'p1', productName: '상품', brandOrStore: '스토어', items: [], state: 'CONFIRMED', delivery: null, totalAmount: 1, unitPrice: 1, shippingFee: 0, address: null, createdAt: '2030-01-01T00:00:00Z', carrier: null, trackingNumber: null, shippedAt: null, deliveredAt: null }));
    expect(await listOrders()).toEqual([]); expect((await getOrder('o1', 'u')).status).toBe('paid');
    expect(calls[0].url).toContain('/v1/orders?size=100'); expect(calls[1].url).toContain('/v1/orders/o1');
    expect(calls.every(c => c.method === 'GET')).toBe(true);
  });
  it('주문 생성 POST /v1/orders (requestKey 포함)', async () => {
    const calls = fake(() => ok(cmd({ state: 'RESERVING' }), 202));
    await createOrder({ productId: 'p1', addressId: 'a1', items: [{ optionId: 'op1', quantity: 2 }] });
    expect(calls[0]).toMatchObject({ method: 'POST', body: { productId: 'p1', addressId: 'a1', items: [{ optionId: 'op1', quantity: 2 }] } });
    expect(calls[0].url).toMatch(/\/v1\/orders$/); expect(calls[0].body.requestKey).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('checkout·약관·결제 설정 조회', async () => {
    const calls = fake(c => ok(c.url.includes('client-configuration') ? { clientKey: 'ck' } : c.url.includes('terms') ? { version: 'v1' } : cmd()));
    await getCheckout('o1'); expect((await getCheckoutTerms()).version).toBe('v1'); expect(await getPaymentClientKey()).toBe('ck');
    expect(calls.map(c => c.url.replace(/^.*\/v1/, '/v1'))).toEqual(['/v1/orders/o1/checkout', '/v1/orders/checkout-terms', '/v1/payments/client-configuration']);
  });
  it('결제 승인 요청·배송지 변경 본문', async () => {
    const calls = fake(() => ok(cmd()));
    await requestPayment('o1', { paymentKey: 'pk', termsVersion: 'v1' }); await changeShippingAddress('o1', 'a2', 3);
    expect(calls[0]).toMatchObject({ method: 'POST', body: { paymentKey: 'pk', termsVersion: 'v1', agreed: true } }); expect(calls[0].url).toContain('/v1/orders/o1/payment-attempts');
    expect(calls[1]).toMatchObject({ method: 'PATCH', body: { addressId: 'a2', expectedVersion: 3 } }); expect(calls[1].url).toContain('/v1/orders/o1/shipping-address');
  });
});

describe('판매 시작 직후 ORDER_UNAVAILABLE 재시도', () => {
  const unavailable = () => new ApiError('외부 연동 설정이나 응답이 준비되지 않았습니다', 503, 'ORDER_UNAVAILABLE');
  it('두 번까지 다시 시도해 성공하면 결과를 돌려준다', async () => {
    const run = vi.fn().mockRejectedValueOnce(unavailable()).mockRejectedValueOnce(unavailable()).mockResolvedValue('o1');
    const onWait = vi.fn(() => true);
    await expect(retryWhileUnavailable(run, onWait, 2, 0)).resolves.toBe('o1');
    expect(run).toHaveBeenCalledTimes(3);
  });
  it('재시도를 다 쓰면 ORDER_UNAVAILABLE을 그대로 던지고, 다른 에러는 바로 던진다', async () => {
    await expect(retryWhileUnavailable(vi.fn().mockRejectedValue(unavailable()), () => true, 2, 0)).rejects.toMatchObject({ code: 'ORDER_UNAVAILABLE' });
    const other = vi.fn().mockRejectedValue(new ApiError('x', 409, 'ORDER_DUPLICATE'));
    await expect(retryWhileUnavailable(other, () => true, 2, 0)).rejects.toMatchObject({ code: 'ORDER_DUPLICATE' }); expect(other).toHaveBeenCalledTimes(1);
  });
  it('기다리는 사이 화면을 닫으면 멈춘다', async () => {
    let open = true; const run = vi.fn().mockRejectedValue(unavailable());
    await expect(retryWhileUnavailable(run, () => { const o = open; open = false; return o; }, 2, 0)).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
