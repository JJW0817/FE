import { afterEach, describe, expect, it } from 'vitest';
import { api } from './client';
import { getProduct, getSchedule, listProducts, mergeProducts, productFromApi, productSummaryFromApi } from './products';
import { available, emptyState, stockLeft, stockTotal } from '../domain';
import type { ProductDetailDto, ProductSummaryDto } from './types';

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


const summary: ProductSummaryDto = { id: 'p1', name: '테스트 상품', brandOrStore: '테스트 스토어', category: '의류', price: 10000, image: { id: 'i1', objectKey: 'k', url: 'https://img/1', contentType: 'image/png', position: 0, representative: true },
  status: 'ON_SALE', startsAt: '2030-01-01T01:00:00Z', endsAt: '2030-01-01T04:00:00Z', soldOutAt: null, stock: { initialQuantity: 10, confirmedQuantity: 2, availableQuantity: 7, approximate: true }, metadata: { version: 1, occurredAt: 'x', projectedAt: 'x' } };
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, code: 'COMMON_SUCCESS', message: '', data }), { status: 200, headers: { 'content-type': 'application/json' } });
function fake(handler: (url: string) => Response) { const calls: string[] = []; api.configure({ mock: false, fetch: (async (u: RequestInfo | URL) => { calls.push(String(u)); return handler(String(u)); }) as typeof fetch }); return calls; }
afterEach(() => api.configure({ fetch: undefined }));

describe('변환', () => {
  it('상세 → Product (이미지 정렬·URL 없는 이미지 제외, 시각 ms, 서버 재고)', () => {
    const p = productFromApi(detail);
    expect(p).toMatchObject({ id: 'p1', brand: '테스트 스토어', originalUrl: 'https://store.example.invalid/p', shipping: 3000, maxPerAccount: 2, dispatchDays: 3, reason: '시즌 종료', published: true, live: { initial: 10, available: 0 } });
    expect(p.images).toEqual(['https://img/1', 'https://img/2']);
    expect(p.options).toEqual([{ id: 'o1', name: '크림', stock: 7 }]);
    expect(p.dimensions).toEqual([{ name: '색상', values: '크림, 네이비' }]);
    expect(p.extras).toEqual([{ key: '소재', value: '면 100%' }]);
    expect(p.soldOutAt).toBe(Date.parse('2030-01-01T01:23:00Z'));
    expect(productFromApi({ ...detail, soldOutAt: null }).soldOutAt).toBeUndefined();
  });
  it('서버 재고는 로컬 주문으로 다시 빼지 않는다', () => {
    const s = emptyState(), p = productFromApi(detail);
    s.orders.push({ productId: 'p1', status: 'paid', lines: [{ optionId: 'o1', name: '', quantity: 3 }] } as never);
    expect(available(s, p, 'o1', 0)).toBe(7);
    const sum = productSummaryFromApi(summary);
    expect(stockLeft(s, sum, 0)).toBe(7);
    expect(stockTotal(sum)).toBe(10);
  });
  it('목록 요약이 이미 받은 상세(옵션·설명)를 지우지 않는다', () => {
    const s = emptyState();
    mergeProducts(s, [productFromApi(detail)]);
    mergeProducts(s, [productSummaryFromApi({ ...summary, price: 9000 })]);
    expect(s.products).toHaveLength(1);
    expect(s.products[0]).toMatchObject({ price: 9000, description: '설명', shipping: 3000 });
    expect(s.products[0].options).toHaveLength(1);
  });
});

describe('API 함수 (fetch 가짜)', () => {
  it('listProducts: 쿼리(시각은 ISO)·data.items 변환', async () => {
    const calls = fake(() => ok({ items: [summary], page: 0, size: 100, totalElements: 1, totalPages: 1, serverTime: '2030-01-01T01:00:00Z' }));
    const r = await listProducts({ size: 100, startsFrom: Date.parse('2030-01-01T00:00:00Z') });
    expect(calls[0]).toBe('/api/v1/products?size=100&startsFrom=2030-01-01T00%3A00%3A00.000Z');
    expect(r.items[0]).toMatchObject({ id: 'p1', live: { initial: 10, available: 7 } });
    expect(r.serverTime).toBe(Date.parse('2030-01-01T01:00:00Z'));
  });
  it('getProduct: 경로 인코딩·상세 변환', async () => {
    const calls = fake(() => ok(detail));
    expect((await getProduct('p 1')).options[0].name).toBe('크림');
    expect(calls[0]).toBe('/api/v1/products/p%201');
  });
  it('getSchedule: 날짜 키 맵', async () => {
    fake(() => ok({ from: '2030-01-01', to: '2030-01-13', zone: 'Asia/Seoul', days: [{ date: '2030-01-01', productCount: 2, firstStartsAt: '2030-01-01T01:00:00Z' }], serverTime: 'x' }));
    expect(await getSchedule()).toEqual({ '2030-01-01': { count: 2, firstStartsAt: Date.parse('2030-01-01T01:00:00Z') } });
  });
  it('404는 ApiError로 던진다(화면은 LiveStatus로 표시)', async () => {
    fake(() => new Response(JSON.stringify({ code: 'COMMON_RESOURCE_NOT_FOUND', message: '요청한 리소스를 찾을 수 없습니다.', traceId: 't', violations: [] }), { status: 404, headers: { 'content-type': 'application/json' } }));
    await expect(getProduct('x')).rejects.toMatchObject({ status: 404, code: 'COMMON_RESOURCE_NOT_FOUND' });
  });
});
