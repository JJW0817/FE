import { afterEach, describe, expect, it } from 'vitest';
import { api } from './client';
import { addProductFaq, analyzeDraft, answerProductInquiry, basicInfoOf, createProductDraft, deleteProductFaq, deleteProductImage, getAiAnalysis, getProductImageUrl, getRegistrationMetadata, getSalesSummary, getSellerProduct, getSellerProductWithImages, listProductImages, listRevisions, listSellerProductInquiries, listSellerProducts, optionPayload, pollAiAnalysis, reorderProductImages, requestAiAnalysis, saveBasicInfo, saveDetails, saveOptions, savePricingShipping, saveRegistrationFaqs, saveSchedule, sellerProductFromApi, submitListing, submitReview, submitRevision, submitRevisionFromDraft, updateProductFaq, uploadProductImage } from './sellerProducts';
import { blankDraft, optionKey } from '../domain';
import type { Draft } from '../domain';
import type { SellerProductDto } from './types';

const dto = (o: Partial<SellerProductDto> = {}): SellerProductDto => ({
  id: 'p1', sellerId: 's1', version: 0, status: 'DRAFT', name: null, description: null, sourceUrl: null, category: null, price: null, shippingFee: null, dispatchBusinessDays: null, perAccountLimit: null, shippingNotice: null, purchaseNotice: null,
  disposalReason: null, startsAt: null, endsAt: null, reviewReason: null, options: [], brandOrStore: null, attributes: [], optionDimensions: [], dispatchAddress: null, returnAddress: null, addressesCapturedAt: null, faqs: [], ...o,
});
type Call = { url: string; method: string; body?: any };
/** 호출 순서대로 handler가 응답 data를 돌려준다. 상품 PUT은 version을 1씩 올려 돌려준다 */
function fake(handler: (c: Call) => unknown) {
  const calls: Call[] = [];
  api.configure({ mock: false, fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
    const c = { url: String(u), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined }; calls.push(c);
    return new Response(JSON.stringify({ success: true, code: 'COMMON_SUCCESS', message: '', data: handler(c) }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch });
  return calls;
}
afterEach(() => api.configure({ fetch: undefined }));
const sig = (c: Call) => `${c.method} ${c.url.replace('/api/v1', '')}`;

describe('변환', () => {
  it('SellerProduct → Product (null은 빈 값, 승인만 published, 반려 사유, version·심사 상태 보관)', () => {
    const p = sellerProductFromApi(dto({ status: 'REJECTED', version: 4, name: '상품', brandOrStore: '스토어', price: 1000, startsAt: '2030-01-01T00:00:00Z', reviewReason: '가격 오류',
      options: [{ id: 'o1', label: '크림 / S', initialQuantity: 5, reservedQuantity: 0, confirmedQuantity: 0, availableQuantity: 5, selections: {} }], optionDimensions: [{ name: '색상', values: ['크림', '네이비'] }], attributes: [{ name: '소재', value: '면' }] }));
    expect(p).toMatchObject({ id: 'p1', name: '상품', brand: '스토어', price: 1000, shipping: 0, published: false, rejectionReason: '가격 오류', version: 4, reviewStatus: 'REJECTED', startsAt: Date.parse('2030-01-01T00:00:00Z') });
    expect(p.options).toEqual([{ id: 'o1', name: '크림 / S', stock: 5 }]); expect(p.dimensions).toEqual([{ name: '색상', values: '크림, 네이비' }]); expect(p.extras).toEqual([{ key: '소재', value: '면' }]);
    expect(sellerProductFromApi(dto({ status: 'APPROVED' })).published).toBe(true);
    expect(sellerProductFromApi(dto({ status: 'IN_REVIEW', reviewReason: 'x' })).rejectionReason).toBeUndefined();
  });
  it('옵션 payload: 수량 0 조합 제외, 쓰이는 값만 차원으로, 서버 id만 유지, 옵션 없음은 기본', () => {
    const d: Draft = { ...blankDraft(), axes: { size: true, color: true }, colors: ['크림', '네이비'], sizes: ['S', 'M'], stock: { [optionKey('크림', 'S')]: 3, [optionKey('크림', 'M')]: 2, [optionKey('네이비', 'S')]: 0, [optionKey('네이비', 'M')]: 0 }, options: [{ id: 'srv-1', name: '크림 / S', stock: 3 }, { id: 'opt-크림 / M', name: '크림 / M', stock: 2 }] };
    const o = optionPayload(d);
    expect(o.variants).toEqual([{ id: 'srv-1', selections: { 색상: '크림', 사이즈: 'S' }, initialQuantity: 3 }, { selections: { 색상: '크림', 사이즈: 'M' }, initialQuantity: 2 }]);
    expect(o.dimensions).toEqual([{ name: '색상', values: ['크림'] }, { name: '사이즈', values: ['S', 'M'] }]);
    expect(optionPayload({ ...blankDraft(), axes: { size: false, color: false }, stock: { [optionKey('', '')]: 4 } })).toEqual({ dimensions: [{ name: '옵션', values: ['기본'] }], variants: [{ selections: { 옵션: '기본' }, initialQuantity: 4 }] });
  });
  it('기본 정보: URL 스킴 보정, 서버 목록에 없는 카테고리는 보내지 않는다', () => {
    const d = { ...blankDraft(), name: ' 상품 ', originalUrl: 'coupang.com/p', category: '패션 › 상의' };
    expect(basicInfoOf(d, ['의류'])).toMatchObject({ name: '상품', description: '상품', sourceUrl: 'https://coupang.com/p', category: undefined });
    expect(basicInfoOf({ ...d, category: '의류' }, ['의류']).category).toBe('의류');
  });
});

describe('상품 관리 API', () => {
  it('목록·초안·메타·집계·상세', async () => {
    const calls = fake(c => c.url.includes('registration-metadata') ? { categories: ['의류'], categoryCriteria: [] } : c.url.includes('sales-summary') ? { productCount: 1 }
      : c.method === 'POST' ? dto() : c.url.endsWith('/seller/products?size=100&status=DRAFT') ? { items: [{ id: 'p1', name: 'a', status: 'DRAFT', version: 1, startsAt: null, endsAt: null, createdAt: 'x', updatedAt: 'x', submittedAt: null }], page: 0, size: 100, totalElements: 1, totalPages: 1 } : dto());
    expect((await listSellerProducts('s1', { status: 'DRAFT' }))[0]).toMatchObject({ id: 'p1', sellerId: 's1', reviewStatus: 'DRAFT', version: 1 });
    expect((await createProductDraft()).version).toBe(0);
    await getRegistrationMetadata(); await getSalesSummary('2030-01'); await getSellerProduct('p1');
    expect(calls.map(sig)).toEqual(['GET /seller/products?size=100&status=DRAFT', 'POST /seller/products', 'GET /seller/products/registration-metadata', 'GET /seller/products/sales-summary?month=2030-01', 'GET /seller/products/p1']);
    expect(calls[1].body).toBeUndefined();
  });
  it('등록 6단계 + 심사 제출은 expectedVersion을 보낸다', async () => {
    const calls = fake(() => dto());
    await saveBasicInfo('p1', 0, { name: 'a' }); await saveDetails('p1', 1, { attributes: [] }); await saveOptions('p1', 2, { dimensions: [], variants: [] });
    await savePricingShipping('p1', 3, { price: 1 }); await saveSchedule('p1', 4, '2030-01-01T00:00:00.000Z'); await saveRegistrationFaqs('p1', 5, [{ question: 'q', answer: 'a' }]); await submitReview('p1', 6);
    expect(calls.map(sig)).toEqual(['PUT /seller/products/p1/registration/basic-info', 'PUT /seller/products/p1/registration/details', 'PUT /seller/products/p1/registration/options', 'PUT /seller/products/p1/registration/pricing-shipping', 'PUT /seller/products/p1/registration/schedule', 'PUT /seller/products/p1/registration/faqs', 'POST /seller/products/p1/review-submissions']);
    expect(calls.map(c => c.body.expectedVersion)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(calls[5].body.faqs).toEqual([{ question: 'q', answer: 'a', confirmed: true }]);
  });
  it('submitListing: 응답 version을 다음 단계에 이어 쓰고 마지막에 심사 제출', async () => {
    let v = 10;
    const calls = fake(c => (c.method === 'GET' ? dto({ version: v }) : dto({ version: ++v })));
    const d: Draft = { ...blankDraft(), name: '상품', price: 5000, shipping: 3000, dispatchDays: 2, maxPerAccount: 2, startsAt: '2030-01-01T10:00', axes: { size: true, color: false }, sizes: ['M'], stock: { [optionKey('', 'M')]: 5 } };
    const p = await submitListing(d, 'p1');
    expect(calls.map(sig)).toEqual(['GET /seller/products/p1', 'PUT /seller/products/p1/registration/basic-info', 'PUT /seller/products/p1/registration/details', 'PUT /seller/products/p1/registration/options', 'PUT /seller/products/p1/registration/pricing-shipping', 'PUT /seller/products/p1/registration/schedule', 'POST /seller/products/p1/review-submissions']);
    expect(calls.slice(1).map(c => c.body.expectedVersion)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(calls[2].body.disposalReason).toBeTruthy(); expect(calls[4].body).toMatchObject({ price: 5000, shippingFee: 3000, dispatchBusinessDays: 2, perAccountLimit: 2 }); expect(calls[4].body.dispatchAddressId).toBeUndefined();
    expect(calls[5].body.startsAt).toBe(new Date('2030-01-01T10:00').toISOString()); expect(p.version).toBe(16);
  });
  it('submitListing: 수량이 없으면 옵션 단계에서 멈춘다', async () => {
    fake(() => dto());
    await expect(submitListing({ ...blankDraft(), axes: { size: false, color: false }, stock: {} }, 'p1')).rejects.toThrow('옵션별 한정 수량');
  });
  it('FAQ 개별: 추가·수정은 본문 faq, 삭제는 query expectedVersion', async () => {
    const calls = fake(() => dto());
    await addProductFaq('p1', 1, { question: 'q', answer: 'a', suggestionId: 's' }); await updateProductFaq('p1', 'f1', 2, { id: 'f1', question: 'q', answer: 'a' }); await deleteProductFaq('p1', 'f1', 3);
    expect(calls.map(sig)).toEqual(['POST /seller/products/p1/faqs', 'PUT /seller/products/p1/faqs/f1', 'DELETE /seller/products/p1/faqs/f1?expectedVersion=3']);
    expect(calls[0].body).toEqual({ expectedVersion: 1, faq: { question: 'q', answer: 'a', suggestionId: 's', confirmed: true } });
  });
  it('수정 심사: 이력은 배열, 제출은 원본 version', async () => {
    const calls = fake(c => (c.method === 'GET' ? [{ id: 'r1', status: 'IN_REVIEW' }] : c.method === 'POST' ? { id: 'r2', status: 'IN_REVIEW' } : null));
    expect(await listRevisions('p1')).toHaveLength(1);
    await submitRevision('p1', 7, { name: 'n', description: 'd', imageIds: ['i1'], representativeId: 'i1', shippingFee: 0, dispatchBusinessDays: 1, startsAt: 'x' });
    expect(calls.map(sig)).toEqual(['GET /seller/products/p1/revisions', 'POST /seller/products/p1/revisions']); expect(calls[1].body).toMatchObject({ expectedVersion: 7, imageIds: ['i1'], representativeId: 'i1' });
  });
  it('submitRevisionFromDraft: 최신 version으로, 대표=첫 이미지, 사진 없으면 거절', async () => {
    const calls = fake(c => (c.method === 'GET' ? dto({ version: 9, status: 'APPROVED' }) : { id: 'r', status: 'IN_REVIEW' }));
    await submitRevisionFromDraft({ ...blankDraft(), name: '이름', imageIds: ['a', 'b'], startsAt: '2030-01-01T10:00' }, 'p1');
    expect(calls[1].body).toMatchObject({ expectedVersion: 9, imageIds: ['a', 'b'], representativeId: 'a', name: '이름' });
    await expect(submitRevisionFromDraft({ ...blankDraft(), name: 'x' }, 'p1')).rejects.toThrow('사진');
  });
});

describe('이미지', () => {
  it('목록·열람 URL·순서·삭제', async () => {
    const calls = fake(c => (c.url.endsWith('/images') && c.method === 'GET' ? [{ id: 'i1' }] : c.url.includes('download-url') ? { downloadUrl: 'https://s3/i1', expiresAt: 'x' } : null));
    await listProductImages('p1'); expect(await getProductImageUrl('p1', 'i1')).toBe('https://s3/i1'); await reorderProductImages('p1', ['i2', 'i1'], 'i2'); await deleteProductImage('p1', 'i1');
    expect(calls.map(sig)).toEqual(['GET /seller/products/p1/images', 'GET /seller/products/p1/images/i1/download-url', 'PUT /seller/products/p1/images', 'DELETE /seller/products/p1/images/i1']);
    expect(calls[2].body).toEqual({ imageIds: ['i2', 'i1'], representativeId: 'i2' });
  });
  it('상세+이미지: 위치순 정렬, 열람 URL 매핑', async () => {
    fake(c => (c.url.endsWith('/images') ? [{ id: 'b', position: 1 }, { id: 'a', position: 0 }] : c.url.includes('download-url') ? { downloadUrl: `u-${c.url.split('/images/')[1].split('/')[0]}` } : dto({ status: 'APPROVED' })));
    const p = await getSellerProductWithImages('p1'); expect(p.images).toEqual(['u-a', 'u-b']); expect(p.imageIds).toEqual(['a', 'b']);
  });
  it('업로드: 권한 발급 → Authorization 없는 S3 PUT → 완료 확인', async () => {
    const calls = fake(c => (c.url.endsWith('image-uploads') ? { imageId: 'i1', uploadUrl: 'https://s3/put', contentType: 'image/png', sizeBytes: 3, expiresAt: 'x' } : c.url.includes('download-url') ? { downloadUrl: 'https://s3/get' } : { id: 'i1' }));
    const puts: { url: string; init?: RequestInit }[] = [];
    const r = await uploadProductImage('p1', new File(['abc'], 'a.png', { type: 'image/png' }), (async (u: RequestInfo | URL, init?: RequestInit) => { puts.push({ url: String(u), init }); return new Response(null, { status: 200 }); }) as typeof fetch);
    expect(r).toEqual({ id: 'i1', url: 'https://s3/get' });
    expect(calls.map(sig)).toEqual(['POST /seller/products/p1/image-uploads', 'POST /seller/products/p1/images/i1/completion', 'GET /seller/products/p1/images/i1/download-url']);
    expect(calls[0].body).toEqual({ contentType: 'image/png', sizeBytes: 3 });
    expect(puts[0].url).toBe('https://s3/put'); expect(puts[0].init?.method).toBe('PUT'); expect(new Headers(puts[0].init?.headers).get('Authorization')).toBeNull();
  });
  it('업로드: 형식·크기 검증, S3 실패 시 연결 해제', async () => {
    await expect(uploadProductImage('p1', new File(['a'], 'a.gif', { type: 'image/gif' }))).rejects.toThrow('JPG');
    const calls = fake(c => (c.url.endsWith('image-uploads') ? { imageId: 'i1', uploadUrl: 'https://s3/put' } : null));
    await expect(uploadProductImage('p1', new File(['abc'], 'a.png', { type: 'image/png' }), (async () => new Response(null, { status: 403 })) as typeof fetch)).rejects.toThrow('올리지 못했어요');
    expect(calls.map(sig)).toEqual(['POST /seller/products/p1/image-uploads', 'DELETE /seller/products/p1/images/i1']);
  });
});

describe('AI 분석', () => {
  it('요청(202)과 조회는 requestId 경로', async () => {
    const calls = fake(c => (c.method === 'POST' ? { requestId: 'r1', productId: 'p1', fingerprint: 'f', completed: false } : { requestId: 'r1', status: 'PENDING', result: null }));
    expect((await requestAiAnalysis('p1', 3)).requestId).toBe('r1'); await getAiAnalysis('r1');
    expect(calls.map(sig)).toEqual(['POST /seller/products/p1/ai-analyses', 'GET /ai/product-analyses/r1']); expect(calls[0].body).toEqual({ expectedVersion: 3 });
  });
  it('폴링: RETRY는 계속, COMPLETED면 결과, 끝내 안 오면 안내', async () => {
    let n = 0;
    fake(() => (++n < 3 ? { status: n === 1 ? 'PENDING' : 'RETRY', result: null } : { status: 'COMPLETED', result: { outcome: 'RECOMMENDED', recommendedCategory: 'CLOTHING', questions: [] } }));
    expect((await pollAiAnalysis('r1', { interval: 0 })).outcome).toBe('RECOMMENDED'); expect(n).toBe(3);
    fake(() => ({ status: 'RUNNING', result: null }));
    await expect(pollAiAnalysis('r1', { interval: 0, tries: 2 })).rejects.toThrow('지연');
  });
  it('analyzeDraft: 기본 정보 저장 → 요청(새 version) → 폴링, 코드는 점검 기준 이름으로', async () => {
    const calls = fake(c => c.url.includes('registration-metadata') ? { categories: ['의류'], categoryCriteria: [{ code: 'CLOTHING', name: '의류', checks: [] }] }
      : c.url.includes('/ai-analyses') ? { requestId: 'r1' } : c.url.includes('/ai/product-analyses/') ? { status: 'COMPLETED', result: { outcome: 'RECOMMENDED', recommendedCategory: 'CLOTHING', questions: [{ suggestionId: 's', checkCode: 'c', question: 'q', reason: 'r' }] } }
      : c.method === 'PUT' ? dto({ version: 6 }) : dto({ version: 5 }));
    const r = await analyzeDraft({ ...blankDraft(), name: '상품' }, 'p1', { interval: 0 });
    expect(r).toMatchObject({ outcome: 'RECOMMENDED', category: '의류' }); expect(r.questions).toHaveLength(1);
    expect(calls.find(c => c.url.includes('basic-info'))!.body.expectedVersion).toBe(5); expect(calls.find(c => c.url.includes('/ai-analyses'))!.body.expectedVersion).toBe(6);
  });
});

describe('문의 답변', () => {
  it('문의함 조회(items)와 답변 PUT(문의 version, publishToFaq)', async () => {
    const q = { id: 'q1', productId: 'p1', buyerId: 'b1', version: 2, question: '질문', answer: null, createdAt: '2030-01-01T00:00:00Z', answeredAt: null };
    const calls = fake(c => (c.method === 'GET' ? { items: [q], page: 0, size: 100, totalElements: 1, totalPages: 1 } : { ...q, version: 3, answer: '답' }));
    expect((await listSellerProductInquiries('s1', { unanswered: true }))[0]).toMatchObject({ id: 'q1', userId: 'b1', sellerId: 's1', productId: 'p1', kind: '상품 문의', version: 2, answer: undefined });
    const a = await answerProductInquiry('s1', 'p1', 'q1', { expectedVersion: 2, answer: '답', publishToFaq: true });
    expect(a).toMatchObject({ answer: '답', version: 3, public: true });
    expect(calls.map(sig)).toEqual(['GET /seller/products/inquiries?size=100&unanswered=true', 'PUT /seller/products/p1/inquiries/q1/answer']);
    expect(calls[1].body).toEqual({ publishToFaq: true, expectedVersion: 2, answer: '답' });
  });
});
