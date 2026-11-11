import { afterEach, describe, expect, it } from 'vitest';
import { api } from './client';
import { answerOrderInquiry, completeDelivery, deliverOrder, getFulfillment, getSellerInquiryEditing, getSellerInquiryImageUrl, getSellerOrder, getSellerOrderInquiry, getSellerOrderSummary, listSellerOrderInquiries, listSellerOrderInquiryInbox, listSellerOrders, registerShipment, shipOrder } from './sellerOrders';
import type { OrderCommandDto } from './types';

type Call = { url: string; method: string; body?: any };
function fake(handler: (c: Call) => unknown) {
  const calls: Call[] = [];
  api.configure({ mock: false, fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
    const c = { url: String(u), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined }; calls.push(c);
    return new Response(JSON.stringify({ success: true, code: 'COMMON_SUCCESS', message: '', data: handler(c) }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch });
  return calls;
}
afterEach(() => api.configure({ fetch: undefined }));
const sig = (c: Call) => `${c.method} ${c.url.replace(/^(\/pg)?\/api\/v1/, '')}`;
const cmd = (o: Partial<OrderCommandDto> = {}): OrderCommandDto => ({
  orderId: 'o1', orderNumber: 'N1', version: 7, state: 'CONFIRMED', delivery: 'PREPARING', productId: 'p1', sellerId: 's1', productName: '상품', brandOrStore: '스토어', items: [{ optionId: 'op1', label: '크림', quantity: 1 }],
  address: { recipientName: '홍', recipientPhone: '010', postalCode: '1', roadAddress: '도로', detailAddress: null, deliveryMemo: null }, unitPrice: 1000, shippingFee: 3000, totalAmount: 4000, dispatchBusinessDays: 2, expiresAt: null,
  serverTime: '2030-01-01T00:00:00Z', paymentAttemptId: null, confirmedAt: '2030-01-01T00:00:00Z', carrier: null, trackingNumber: null, failureCode: null, termsVersion: null, ...o,
});
const item = (o: object = {}) => ({ orderId: 'o1', orderNumber: 'N1', productId: 'p1', productName: '상품', brandOrStore: '스토어', items: [{ optionId: 'op1', label: '크림', quantity: 2 }], state: 'CONFIRMED', delivery: 'PREPARING', totalAmount: 5000, createdAt: '2030-01-01T00:00:00Z', sourceVersion: 1, ...o });
const page = (content: unknown[]) => ({ content, page: 0, size: 100, totalElements: content.length, totalPages: 1 });

describe('판매자 주문 조회', () => {
  it('목록: content, CONFIRMED만 주문으로, sellerId는 호출한 판매자, 배송 상태 반영', async () => {
    const calls = fake(() => page([item(), item({ orderId: 'o2', delivery: 'SHIPPING' }), item({ orderId: 'o3', state: 'HELD', delivery: null })]));
    const list = await listSellerOrders('s1', { productId: 'p1' });
    expect(list.map(o => [o.id, o.sellerId, o.status])).toEqual([['o1', 's1', 'preparing'], ['o2', 's1', 'shipping']]);
    expect(sig(calls[0])).toBe('GET /seller/orders?size=100&productId=p1');
  });
  it('상세·집계', async () => {
    const calls = fake(c => (c.url.includes('summary') ? { totalOrders: 3, confirmedOrders: 3, preparingOrders: 1, shippingOrders: 1, deliveredOrders: 1, confirmedQuantity: 5, approximate: true }
      : { ...item(), address: { recipientName: '홍', recipientPhone: '010', postalCode: '1', roadAddress: '도로', detailAddress: null, deliveryMemo: null }, unitPrice: 1000, shippingFee: 3000, dispatchBusinessDays: 2, expiresAt: null, confirmedAt: null, carrier: 'CJ', trackingNumber: 'T1', shippedAt: null, deliveredAt: null }));
    expect(await getSellerOrder('o1', 's1')).toMatchObject({ id: 'o1', sellerId: 's1', carrier: 'CJ', tracking: 'T1', shipping: 3000 });
    expect((await getSellerOrderSummary({ productId: 'p1' })).confirmedQuantity).toBe(5);
    expect(calls.map(sig)).toEqual(['GET /seller/orders/o1', 'GET /seller/orders/summary?productId=p1']);
  });
});

describe('출고·배송', () => {
  it('fulfillment 원본 → shipment / delivery-completion은 expectedVersion', async () => {
    const calls = fake(c => (c.method === 'GET' ? cmd() : c.url.endsWith('shipment') ? cmd({ version: 8, delivery: 'SHIPPING', carrier: 'CJ', trackingNumber: 'T1' }) : cmd({ version: 9, delivery: 'DELIVERED', carrier: 'CJ', trackingNumber: 'T1' })));
    expect((await getFulfillment('o1')).version).toBe(7);
    await registerShipment('o1', { carrier: 'CJ', trackingNumber: 'T1', expectedVersion: 7 }); await completeDelivery('o1', 8);
    expect(calls.map(sig)).toEqual(['GET /seller/orders/o1/fulfillment', 'POST /seller/orders/o1/shipment', 'POST /seller/orders/o1/delivery-completion']);
    expect(calls[1].body).toEqual({ carrier: 'CJ', trackingNumber: 'T1', expectedVersion: 7 }); expect(calls[2].body).toEqual({ expectedVersion: 8 });
  });
  it('shipOrder/deliverOrder: fulfillment version을 읽어 보내고 갱신된 주문을 돌려준다', async () => {
    const calls = fake(c => (c.method === 'GET' ? cmd({ version: 11 }) : cmd({ version: 12, delivery: c.url.endsWith('shipment') ? 'SHIPPING' : 'DELIVERED', carrier: 'CJ', trackingNumber: 'T1' })));
    const a = await shipOrder('o1', 's1', 'CJ', 'T1');
    expect(a).toMatchObject({ status: 'shipping', carrier: 'CJ', tracking: 'T1', sellerId: 's1' }); expect(calls[1].body.expectedVersion).toBe(11);
    const b = await deliverOrder('o1', 's1'); expect(b.status).toBe('delivered'); expect(calls[3].body).toEqual({ expectedVersion: 11 });
  });
});

describe('판매자 주문 문의', () => {
  const inq = { id: 'i1', orderId: 'o1', category: '배송', messages: [{ seller: false, body: '질문', createdAt: '2030-01-01T00:00:00Z' }], imageIds: ['m1'], createdAt: '2030-01-01T00:00:00Z' };
  it('문의함·주문별 목록·상세', async () => {
    const calls = fake(c => (c.url.includes('/seller/orders/inquiries') ? page([{ id: 'i1', orderId: 'o1', productId: 'p1', productName: '상품', category: '배송', lastMessage: '질문', lastMessageAt: 'x', awaitingSeller: true, createdAt: '2030-01-01T00:00:00Z' }]) : c.url.includes('o1/inquiries?') ? page([inq]) : inq));
    expect((await listSellerOrderInquiryInbox('s1', { unansweredOnly: true }))[0]).toMatchObject({ id: 'i1', sellerId: 's1', productName: '상품', answer: undefined });
    expect((await listSellerOrderInquiries('o1', 's1'))[0]).toMatchObject({ id: 'i1', sellerId: 's1', imageIds: ['m1'] });
    expect(await getSellerOrderInquiry('o1', 'i1', 's1')).toMatchObject({ question: '질문', sellerId: 's1' });
    expect(calls.map(sig)).toEqual(['GET /seller/orders/inquiries?size=100&unansweredOnly=true', 'GET /seller/orders/o1/inquiries?size=100', 'GET /seller/orders/o1/inquiries/i1']);
  });
  it('답변: requestKey+body, 원본 조회와 이미지 열람 URL', async () => {
    const calls = fake(c => (c.url.endsWith('download') ? { url: 'https://s3/img' } : c.url.endsWith('answers') ? { ...inq, messages: [...inq.messages, { seller: true, body: '답변', createdAt: '2030-01-02T00:00:00Z' }] } : { ...inq, version: 4 }));
    const a = await answerOrderInquiry('o1', 'i1', '답변', 's1', '11111111-1111-1111-1111-111111111111');
    expect(a).toMatchObject({ answer: '답변', sellerId: 's1' }); expect(calls[0].body).toEqual({ requestKey: '11111111-1111-1111-1111-111111111111', body: '답변' });
    expect((await getSellerInquiryEditing('o1', 'i1')).version).toBe(4); expect(await getSellerInquiryImageUrl('o1', 'm1')).toBe('https://s3/img');
    expect(calls.map(sig)).toEqual(['POST /seller/orders/o1/inquiries/i1/answers', 'GET /seller/orders/o1/inquiries/i1/editing', 'GET /seller/orders/o1/inquiry-images/m1/download']);
  });
});
