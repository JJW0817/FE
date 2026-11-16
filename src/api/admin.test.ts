import { afterEach, describe, expect, it } from 'vitest';
import { api } from './client';
import { approveSellerApplication, decideProductReview, decideRevision, getAdminApplication, getAdminProductReviewWithImages, getAdminRevision, getAdminRevisionImageUrl, getCorrectionRequest, listAdminApplications, listAdminProductReviews, listAdminRevisions, markApplication, mergeAdminApplications, mergeAdminProductList, rejectSellerApplication, requestCorrection, reviewCertificate } from './admin';
import type { State } from '../domain';

type Call = { url: string; method: string; body: unknown };
function fake(handler: (c: Call) => unknown, blob = false) {
  const calls: Call[] = [];
  api.configure({ mock: false, fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
    const c: Call = { url: String(u), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined }; calls.push(c);
    if (blob) return new Response('pdf', { status: 200, headers: { 'content-type': 'application/pdf' } });
    return new Response(JSON.stringify({ success: true, code: 'COMMON_SUCCESS', message: '', data: handler(c) ?? null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch });
  return calls;
}
afterEach(() => api.configure({ fetch: undefined }));
const path = (c: Call) => `${c.method} ${c.url.split('/v1')[1]}`;
const addr = { postalCode: '1', roadAddress: '서울', detailAddress: null };
const appDto = { applicationId: 'ap1', accountId: 'acc1', attemptNumber: 1, sellerDisplayName: '스토어', contactName: '홍', contactEmail: 'h@x.kr', contactPhone: '010', bankName: '신한', maskedBankAccount: '***9', dispatchAddress: addr, returnAddress: addr, status: 'PENDING', submittedAt: '2026-01-01T00:00:00Z', reviewedAt: null, reviewedBy: null, rejectionReason: null, certificateReviewed: false, certificateRecheck: false, previousApplicationId: null };
const prod = { id: 'p1', sellerId: 's1', version: 3, status: 'IN_REVIEW', name: '상품', description: 'd', sourceUrl: null, category: '의류', price: 1000, shippingFee: 0, dispatchBusinessDays: 2, perAccountLimit: 1, shippingNotice: null, purchaseNotice: null, disposalReason: null, startsAt: '2026-02-01T00:00:00Z', endsAt: null, reviewReason: null, options: [], brandOrStore: 'B', attributes: [], optionDimensions: [], dispatchAddress: null, returnAddress: null, addressesCapturedAt: null, faqs: [] };

describe('운영자 입점 심사', () => {
  it('목록·상세·PDF 열람·승인·반려·보완 요청: URL/메서드/본문', async () => {
    let calls = fake(() => ({ content: [appDto] }));
    const list = await listAdminApplications({ status: 'PENDING' });
    expect(list[0]).toMatchObject({ id: 'ap1', userId: 'acc1', status: 'pending' }); expect(calls[0].url).toContain('/v1/admin/seller-applications?'); expect(calls[0].url).toContain('status=PENDING');
    calls = fake(() => appDto); expect((await getAdminApplication('ap1')).id).toBe('ap1'); expect(path(calls[0])).toBe('GET /admin/seller-applications/ap1');
    calls = fake(() => null, true); expect(await reviewCertificate('ap1')).toBeInstanceOf(Blob); expect(path(calls[0])).toBe('POST /admin/seller-applications/ap1/certificate-review');
    calls = fake(() => null);
    await approveSellerApplication('ap1'); await rejectSellerApplication('ap1', ' 사유 ');
    expect(calls.map(path)).toEqual(['POST /admin/seller-applications/ap1/approve', 'POST /admin/seller-applications/ap1/reject']); expect(calls[1].body).toEqual({ reason: '사유' });
    calls = fake(() => ({ id: 'c', applicationId: 'ap1', deadline: 'x', state: 'OPEN', items: [], submittedApplicationId: null }));
    await requestCorrection('ap1', new Date('2030-01-01T00:00:00Z'), [{ field: 'CERTIFICATE', reason: '흐림' }]); await getCorrectionRequest('ap1');
    expect(calls[0].body).toEqual({ deadline: '2030-01-01T00:00:00.000Z', items: [{ field: 'CERTIFICATE', reason: '흐림' }] }); expect(path(calls[1])).toBe('GET /admin/seller-applications/ap1/correction-request');
  });
  it('merge·mark: 사업자 정보 유지, 승인·반려 반영', () => {
    const s = { applications: [{ id: 'ap1', status: 'pending', business: { name: 'B' } }] } as unknown as State;
    mergeAdminApplications(s, [{ id: 'ap1', status: 'pending' } as never, { id: 'ap2', status: 'pending' } as never]);
    expect(s.applications).toHaveLength(2); expect(s.applications[0].business).toEqual({ name: 'B' });
    markApplication(s, 'ap1', 'approved', 5); markApplication(s, 'ap2', 'rejected', 6, '사유');
    expect(s.applications[0]).toMatchObject({ status: 'approved', approvedAt: 5 }); expect(s.applications[1]).toMatchObject({ status: 'rejected', rejectionItems: [{ field: '입점 심사', reason: '사유' }] });
  });
});

describe('운영자 상품 심사', () => {
  it('목록·상세+이미지·결정: expectedVersion', async () => {
    let calls = fake(() => ({ items: [{ id: 'p1', name: '상품', status: 'IN_REVIEW', version: 3, startsAt: null, endsAt: null, createdAt: 'x', updatedAt: 'x', submittedAt: null }] }));
    expect((await listAdminProductReviews('REJECTED'))[0]).toMatchObject({ id: 'p1', version: 3, published: false }); expect(calls[0].url).toContain('/admin/product-reviews?'); expect(calls[0].url).toContain('status=REJECTED');
    calls = fake(c => c.url.endsWith('/images') ? [{ id: 'i2', position: 1 }, { id: 'i1', position: 0 }] : c.url.includes('download-url') ? { downloadUrl: `u-${c.url.split('/images/')[1].split('/')[0]}` } : prod);
    const p = await getAdminProductReviewWithImages('p1'); expect(p).toMatchObject({ version: 3, images: ['u-i1', 'u-i2'], imageIds: ['i1', 'i2'] });
    calls = fake(() => ({ ...prod, status: 'APPROVED', version: 4 }));
    expect(await decideProductReview('p1', 3, true)).toMatchObject({ published: true, version: 4 }); expect(calls[0].body).toEqual({ expectedVersion: 3, approved: true }); expect(path(calls[0])).toBe('POST /admin/product-reviews/p1/decisions');
    await decideProductReview('p1', 3, false, ' 사진 ');
    expect(calls[1].body).toEqual({ expectedVersion: 3, approved: false, reason: '사진' });
    await expect(decideProductReview('p1', 3, false, ' ')).rejects.toThrow();
  });
  it('merge: 상세로 채운 값은 목록이 0으로 덮지 않는다', () => {
    const s = { products: [{ id: 'p1', name: 'a', price: 1000, published: false }] } as unknown as State;
    mergeAdminProductList(s, [{ id: 'p1', name: 'b', price: 0, published: true, startsAt: 1, endsAt: 2, version: 5, reviewStatus: 'APPROVED' } as never]);
    expect(s.products[0]).toMatchObject({ name: 'b', price: 1000, published: true, version: 5 });
  });
  it('수정 심사: data가 배열, expectedVersion=회차 version', async () => {
    let calls = fake(() => [{ id: 'r1', productId: 'p1', version: 2 }]);
    expect(await listAdminRevisions()).toHaveLength(1); expect(calls[0].url).toContain('/admin/product-reviews/revisions?status=IN_REVIEW');
    calls = fake(() => ({ id: 'r1' })); await getAdminRevision('p1', 'r1'); await decideRevision('p1', 'r1', 2, false, '이유');
    expect(calls.map(path)).toEqual(['GET /admin/product-reviews/p1/revisions/r1', 'POST /admin/product-reviews/p1/revisions/r1/decisions']); expect(calls[1].body).toEqual({ expectedVersion: 2, approved: false, reason: '이유' });
    calls = fake(() => ({ downloadUrl: 'u' })); expect(await getAdminRevisionImageUrl('p1', 'r1', 'i1')).toBe('u'); expect(path(calls[0])).toBe('GET /admin/product-reviews/p1/revisions/r1/images/i1/download-url');
  });
});
