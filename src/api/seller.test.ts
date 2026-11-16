import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, api } from './client';
import { applicationFromApi, createAddressBook, deleteSellerLogo, fetchApplicationCertificate, fetchApplicationHistory, fetchMyApplication, fetchSellerLogo, fetchSellerMe, mergeApplication, requestCertificateReview, resubmitApplication, sellerSettingsFromApi, setDefaultAddressBook, submitApplication, updateSellerAddresses, updateSellerBank, updateSellerContact, updateSellerStore, uploadSellerLogo } from './seller';
import type { SellerApplicationDto, SellerProfileDto } from './types';
import type { State } from '../domain';

type Call = { url: string; method: string; body: unknown; form?: FormData };
type Reply = { error?: { status: number; code: string }; blob?: { body: string; type: string }; data?: unknown };
function fake(handler: (c: Call) => Reply) {
  const calls: Call[] = [];
  api.configure({ mock: false, fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
    const isForm = init?.body instanceof FormData;
    const c: Call = { url: String(u), method: init?.method ?? 'GET', body: !isForm && init?.body ? JSON.parse(String(init.body)) : undefined, form: isForm ? (init!.body as FormData) : undefined }; calls.push(c);
    const r = handler(c);
    if (r.blob) return new Response(r.blob.body, { status: 200, headers: { 'content-type': r.blob.type } });
    if (r.error) return new Response(JSON.stringify({ code: r.error.code, message: 'x' }), { status: r.error.status, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ success: true, code: 'COMMON_SUCCESS', message: '', data: r.data ?? null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch });
  return calls;
}
afterEach(() => api.configure({ fetch: undefined }));
const path = (c: Call) => `${c.method} ${c.url.split('/v1')[1]}`;
const addr = { postalCode: '04066', roadAddress: '서울 마포구', detailAddress: '3층' };
const appDto: SellerApplicationDto = { applicationId: 'ap1', accountId: 'a', attemptNumber: 1, sellerDisplayName: '스토어', contactName: '홍', contactEmail: 'h@x.kr', contactPhone: '010', bankName: '신한', maskedBankAccount: '********9012', dispatchAddress: addr, returnAddress: { ...addr, detailAddress: null }, status: 'PENDING', submittedAt: '2026-01-01T00:00:00Z', reviewedAt: null, reviewedBy: null, rejectionReason: null, certificateReviewed: false, certificateRecheck: false, previousApplicationId: null };
const prof: SellerProfileDto = { accountId: 'a', approvedApplicationId: 'ap1', sellerDisplayName: '스토어', contactName: '홍', contactEmail: 'h@x.kr', contactPhone: '010', bankAccount: { bankName: '신한', maskedBankAccount: '********9012', accountHolderName: null }, dispatchAddress: addr, returnAddress: { ...addr, detailAddress: null }, approvedAt: 'x', updatedAt: 'x' };

describe('입점 신청', () => {
  it('변환: 상태 매핑·보완 항목·서버 문서 id', () => {
    expect(applicationFromApi(appDto, 'u')).toMatchObject({ id: 'ap1', status: 'pending', account: '********9012', shippingAddress: '서울 마포구 3층', returnAddress: '서울 마포구', document: { id: 'server:ap1' } });
    const a = applicationFromApi({ ...appDto, status: 'CHANGES_REQUESTED', reviewedAt: '2026-01-02T00:00:00Z' }, 'u', { id: 'c', applicationId: 'ap1', deadline: '2026-01-09T00:00:00Z', state: 'OPEN', items: [{ field: 'CERTIFICATE', reason: '흐림' }, { field: 'DISPATCH_ADDRESS', reason: '오류' }], submittedApplicationId: null });
    expect(a).toMatchObject({ status: 'rejected', rejectionItems: [{ field: '사업자등록증 PDF', reason: '흐림' }, { field: '출고지', reason: '오류' }], deadlineAt: Date.parse('2026-01-09T00:00:00Z') });
    expect(applicationFromApi({ ...appDto, status: 'APPROVED', reviewedAt: '2026-01-02T00:00:00Z' }, 'u').approvedAt).toBe(Date.parse('2026-01-02T00:00:00Z'));
  });
  it('merge: 본인 신청 교체·추가', () => {
    const s = { applications: [{ id: 'old', userId: 'u', business: { name: 'B' } }] } as unknown as State;
    mergeApplication(s, applicationFromApi(appDto, 'u')); mergeApplication(s, applicationFromApi(appDto, 'v')); mergeApplication(s, null);
    expect(s.applications.map(a => a.id)).toEqual(['ap1', 'ap1']); expect(s.applications.find(a => a.userId === 'u')?.business).toEqual({ name: 'B' });
  });
  it('제출: application(JSON)+certificate 파트', async () => {
    const calls = fake(() => ({ data: { applicationId: 'ap1', status: 'PENDING' } }));
    const r = await submitApplication({ displayName: '', name: '홍', email: 'h@x.kr', phone: '010', bank: '신한', account: '110-123-456789', shippingPostal: '04066', shippingAddress: '서울', returnPostal: '04066', returnAddress: '서울' }, new Blob(['%PDF-'], { type: 'application/pdf' }), 'a.pdf');
    expect(r.applicationId).toBe('ap1'); expect(path(calls[0])).toBe('POST /seller-applications');
    const app = calls[0].form!.get('application') as Blob; expect(app.type).toBe('application/json');
    expect(JSON.parse(await app.text())).toEqual({ contactName: '홍', contactEmail: 'h@x.kr', contactPhone: '010', bankName: '신한', bankAccountNumber: '110123456789', dispatchAddress: { postalCode: '04066', roadAddress: '서울' }, returnAddress: { postalCode: '04066', roadAddress: '서울' } });
    expect((calls[0].form!.get('certificate') as File).name).toBe('a.pdf');
  });
  it('조회: 없으면 null, 보완 요청이면 correction-request도, 이력·PDF', async () => {
    fake(() => ({ error: { status: 404, code: 'SELLER_APPLICATION_NOT_FOUND' } }));
    expect(await fetchMyApplication('u')).toBeNull();
    let calls = fake(c => ({ data: c.url.endsWith('/me') ? { ...appDto, status: 'CHANGES_REQUESTED' } : { id: 'c', applicationId: 'ap1', deadline: '2026-01-09T00:00:00Z', state: 'OPEN', items: [], submittedApplicationId: null } }));
    expect((await fetchMyApplication('u'))?.deadlineAt).toBeTruthy(); expect(calls.map(path)).toEqual(['GET /seller-applications/me', 'GET /seller-applications/ap1/correction-request']);
    calls = fake(() => ({ data: [appDto] })); expect(await fetchApplicationHistory('u')).toHaveLength(1); expect(path(calls[0])).toBe('GET /seller-applications/me/history');
    calls = fake(() => ({ blob: { body: 'pdf', type: 'application/pdf' } })); expect(await fetchApplicationCertificate('ap1')).toBeInstanceOf(Blob); expect(path(calls[0])).toBe('GET /seller-applications/ap1/certificate');
    fake(() => ({ error: { status: 500, code: 'X' } }));
    await expect(fetchMyApplication('u')).rejects.toBeInstanceOf(ApiError);
  });
  it('보완 제출: 요청 항목만', async () => {
    const calls = fake(() => ({ data: { applicationId: 'ap2', status: 'PENDING' } }));
    await resubmitApplication('ap1', { contact: { name: '홍', email: 'h@x.kr', phone: '010' } });
    await resubmitApplication('ap1', { certificate: new Blob(['x']) });
    expect(calls.map(path)).toEqual(['POST /seller-applications/ap1/resubmissions', 'POST /seller-applications/ap1/resubmissions']);
    expect(calls[0].form!.has('certificate')).toBe(false); expect(JSON.parse(await (calls[0].form!.get('application') as Blob).text())).toEqual({ contact: { name: '홍', email: 'h@x.kr', phone: '010' } });
    expect(calls[1].form!.has('application')).toBe(false); expect(calls[1].form!.has('certificate')).toBe(true);
  });
});

describe('판매자 마이페이지·스토어', () => {
  it('조회 변환: 마스킹 계좌·주소 상세 보관', async () => {
    const calls = fake(() => ({ data: prof }));
    const r = await fetchSellerMe(); expect(path(calls[0])).toBe('GET /sellers/me');
    expect(r.settings).toMatchObject({ displayName: '스토어', bank: '신한', account: '********9012', holder: '', shippingAddress: '서울 마포구', shippingPostal: '04066', shippingDetail: '3층', returnDetail: '' }); expect(r.contactEmail).toBe('h@x.kr');
    expect(sellerSettingsFromApi(prof, { notifications: { a: true } } as never).notifications).toEqual({ a: true });
  });
  it('수정: contact·bank-account(bankAccountNumber)·addresses(상세 유지)', async () => {
    const calls = fake(() => ({}));
    await updateSellerContact({ sellerDisplayName: ' ', contactName: '홍', contactEmail: 'h@x.kr', contactPhone: '010' });
    await updateSellerBank({ bank: '신한', account: '110-12-3456', holder: '홍' });
    await updateSellerAddresses({ shippingPostal: '04066', shippingAddress: '서울', shippingDetail: '3층', returnPostal: '04066', returnAddress: '부산', returnDetail: '' } as never);
    expect(calls.map(path)).toEqual(['PUT /sellers/me/contact', 'PUT /sellers/me/bank-account', 'PUT /sellers/me/addresses']);
    expect(calls[0].body).toEqual({ contactName: '홍', contactEmail: 'h@x.kr', contactPhone: '010' });
    expect(calls[1].body).toEqual({ bankName: '신한', bankAccountNumber: '110123456', accountHolderName: '홍' });
    expect(calls[2].body).toEqual({ dispatchAddress: { postalCode: '04066', roadAddress: '서울', detailAddress: '3층' }, returnAddress: { postalCode: '04066', roadAddress: '부산' } });
  });
  it('재심사 신청·주소록·기본 지정', async () => {
    const calls = fake(() => ({}));
    await requestCertificateReview(new Blob(['x']));
    await createAddressBook('DISPATCH', { label: '창고', contactName: '홍', contactPhone: '010', address: addr });
    await setDefaultAddressBook('RETURN', 'x1');
    expect(calls.map(path)).toEqual(['POST /sellers/me/certificate-reviews', 'POST /sellers/me/address-book/DISPATCH', 'PUT /sellers/me/address-book/RETURN/x1/default']);
    expect(calls[0].form!.has('certificate')).toBe(true);
  });
  it('스토어: 소개 trim, 로고 업로드(image 파트)·검증·조회(blob)·삭제', async () => {
    const calls = fake(c => (c.method === 'GET' ? { blob: { body: 'img', type: 'image/png' } } : { data: { sellerDisplayName: 's', introduction: 'i', hasLogo: true, updatedAt: 'x' } }));
    await updateSellerStore(' 안녕 '); expect(calls[0].body).toEqual({ introduction: '안녕' });
    await uploadSellerLogo(new File(['x'], 'l.png', { type: 'image/png' })); expect(calls[1].form!.has('image')).toBe(true);
    expect(await fetchSellerLogo()).toBeInstanceOf(Blob); await deleteSellerLogo();
    expect(calls.map(path)).toEqual(['PUT /sellers/me/store', 'POST /sellers/me/store/logo', 'GET /sellers/me/store/logo', 'DELETE /sellers/me/store/logo']);
    await expect(uploadSellerLogo(new File(['x'], 'l.gif', { type: 'image/gif' }))).rejects.toThrow('JPG');
    await expect(uploadSellerLogo(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'l.png', { type: 'image/png' }))).rejects.toThrow('2MB');
    expect(calls).toHaveLength(4);
  });
});
