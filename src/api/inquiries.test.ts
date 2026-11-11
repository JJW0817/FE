import { afterEach, describe, expect, it } from 'vitest';
import { api } from './client';
import { addInquiryMessage, createOrderInquiry, createProductInquiry, getInquiryImageUrl, listInquiryInbox, listProductInquiries, mergeInquiries, orderInquiryFromApi, uploadInquiryImage } from './inquiries';
import type { State } from '../domain';

type Call = { url: string; method: string; body: unknown; auth: string | null };
function fake(handler: (c: Call) => unknown) {
  const calls: Call[] = [];
  api.configure({ mock: false, fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
    const c = { url: String(u), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined, auth: new Headers(init?.headers).get('Authorization') }; calls.push(c);
    return new Response(JSON.stringify({ success: true, code: 'COMMON_SUCCESS', message: '', data: handler(c) }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch });
  return calls;
}
afterEach(() => api.configure({ fetch: undefined }));
const path = (c: Call) => c.url.split('/v1')[1];
const dto = { id: 'i1', orderId: 'o1', category: '하자·파손', messages: [{ seller: false, body: '질문', createdAt: '2026-01-01T00:00:00Z' }, { seller: true, body: '답변', createdAt: '2026-01-02T00:00:00Z' }], imageIds: ['m1'], createdAt: '2026-01-01T00:00:00Z' };

describe('문의 API', () => {
  it('변환: 첫 구매자 메시지=question, 마지막 판매자 메시지=answer', () => {
    expect(orderInquiryFromApi(dto, 'u')).toMatchObject({ id: 'i1', orderId: 'o1', kind: '하자·파손', question: '질문', answer: '답변', imageIds: ['m1'] });
  });
  it('상품 문의: 조회는 items, 등록은 body {question}', async () => {
    const calls = fake(c => (c.method === 'GET' ? { items: [{ id: 'p1', question: 'q', answer: null, createdAt: '2026-01-01T00:00:00Z', answeredAt: null }] } : { id: 'p2', question: 'x', answer: null, createdAt: '2026-01-01T00:00:00Z', answeredAt: null }));
    expect((await listProductInquiries('pr', 'u'))[0]).toMatchObject({ id: 'p1', kind: '상품 문의', productId: 'pr', answer: undefined });
    await createProductInquiry('pr', 'x', 'u');
    expect(calls.map(c => `${c.method} ${path(c).split('?')[0]}`)).toEqual(['GET /products/pr/inquiries', 'POST /products/pr/inquiries']);
    expect(calls[1].body).toEqual({ question: 'x' });
  });
  it('문의함·등록·추가 메시지', async () => {
    const calls = fake(c => (c.method === 'GET' ? { content: [{ id: 'i1', orderId: 'o1', productId: 'p', productName: '상품', category: '기타', lastMessage: 'm', lastMessageAt: '2026-01-01T00:00:00Z', awaitingSeller: true, createdAt: '2026-01-01T00:00:00Z' }] } : dto));
    expect((await listInquiryInbox('u'))[0]).toMatchObject({ id: 'i1', answer: undefined, question: 'm' });
    await createOrderInquiry('o1', { category: '기타', body: 'b', imageIds: ['m1'] }, 'u');
    await addInquiryMessage('o1', 'i1', '추가', 'u', '11111111-1111-1111-1111-111111111111');
    expect(calls.map(c => `${c.method} ${path(c).split('?')[0]}`)).toEqual(['GET /orders/inquiries', 'POST /orders/o1/inquiries', 'POST /orders/o1/inquiries/i1/messages']);
    expect(calls[1].body).toMatchObject({ category: '기타', body: 'b', imageIds: ['m1'] }); expect((calls[1].body as any).requestKey).toBeTruthy();
    expect(calls[2].body).toEqual({ requestKey: '11111111-1111-1111-1111-111111111111', body: '추가' });
  });
  it('이미지 업로드: 권한 발급 → Authorization 없는 PUT(정확한 Content-Type) → completion', async () => {
    api.setAccessToken('tok');
    const calls = fake(c => (path(c).endsWith('/inquiry-images') ? { id: 'm1', url: 'https://s3.example/put', contentType: 'image/png', sizeBytes: 3, expiresAt: 'x' } : { id: 'm1', url: null, contentType: 'image/png', sizeBytes: 3, expiresAt: 'x' }));
    const puts: { url: string; init?: RequestInit }[] = [];
    const file = new File(['abc'], 'a.png', { type: 'image/png' });
    const id = await uploadInquiryImage('o1', file, (async (u: RequestInfo | URL, init?: RequestInit) => { puts.push({ url: String(u), init }); return new Response(null, { status: 200 }); }) as typeof fetch);
    expect(id).toBe('m1');
    expect(calls.map(c => `${c.method} ${path(c)}`)).toEqual(['POST /orders/o1/inquiry-images', 'POST /orders/o1/inquiry-images/m1/completion']);
    expect(calls[0].body).toEqual({ contentType: 'image/png', sizeBytes: 3 });
    expect(puts[0].url).toBe('https://s3.example/put'); expect(puts[0].init?.method).toBe('PUT'); expect(puts[0].init?.headers).toEqual({ 'Content-Type': 'image/png' });
    api.setAccessToken(null);
  });
  it('열람 URL: download', async () => {
    const calls = fake(() => ({ id: 'm1', url: 'https://s3.example/get', contentType: 'image/png', sizeBytes: 3, expiresAt: 'x' }));
    expect(await getInquiryImageUrl('o1', 'm1')).toBe('https://s3.example/get'); expect(path(calls[0])).toBe('/orders/o1/inquiry-images/m1/download');
  });
  it('merge: 상품명·판매자는 주문에서 채우고 카드가 상세 메시지를 지우지 않음', () => {
    const s = { orders: [{ id: 'o1', sellerId: 'sl', productId: 'p', product: { brand: 'B', name: 'N' }, lines: [{ quantity: 2 }] }], products: [], inquiries: [] } as unknown as State;
    mergeInquiries(s, [orderInquiryFromApi(dto, 'u')]);
    mergeInquiries(s, [{ id: 'i1', userId: 'u', sellerId: '', productId: 'p', orderId: 'o1', productName: '', kind: '하자·파손', question: 'm', public: false, createdAt: 1 }]);
    expect(s.inquiries).toHaveLength(1); expect(s.inquiries[0]).toMatchObject({ productName: 'B · N', sellerId: 'sl', quantity: 2 }); expect(s.inquiries[0].messages).toHaveLength(2);
  });
});
