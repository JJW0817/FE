/**
 * 판매자 도메인(1/2) — 입점 신청 7개(명세 6절) + 마이페이지·주소록·스토어 17개(명세 9절). 모두 Account service(`account`).
 * 실제 모드: API 호출 / mock 모드: 호출하지 않는다(화면이 `USE_MOCK`으로 갈라 기존 로컬 동작 유지).
 * 사업자 정보(상호·대표자·등록번호)는 서버 응답에 없어 화면의 mock 표시를 그대로 둔다 (TODO(api-gap): docs/api-gap.md).
 */
import type { Application, SellerSettings, State } from '../domain';
import { ApiError, api } from './client';
import { ms } from './mappers';
import type { CorrectionField, CorrectionRequestDto, SellerAddressBookDto, SellerAddressDto, SellerApplicationDto, SellerProfileDto, SellerStoreDto } from './types';

const account = 'account' as const;
const enc = encodeURIComponent;
const APPS = '/v1/seller-applications';
const ME = '/v1/sellers/me';
/** DocumentFile.id 접두사: 서버에 제출된 사업자등록증(열람은 files.getPdf가 /certificate로 처리) */
export const SERVER_DOC = 'server:';

/* ── 변환 ── */
/** 보완 요청 항목 이름 → 화면(ApplicationPage)이 쓰는 항목 이름 */
const FIELD_LABEL: Record<CorrectionField, string> = { CERTIFICATE: '사업자등록증 PDF', STORE_NAME: '판매자 표시 이름', CONTACT: '담당자', BANK_ACCOUNT: '정산 계좌번호', DISPATCH_ADDRESS: '출고지', RETURN_ADDRESS: '반품 주소' };
const addrLine = (a: SellerAddressDto) => [a.roadAddress, a.detailAddress].filter(Boolean).join(' ');

/** 신청 응답(+보완 요청) → 화면 Application. CHANGES_REQUESTED·REJECTED는 화면의 'rejected', 나머지 미지 상태는 심사 중 */
export function applicationFromApi(d: SellerApplicationDto, userId: string, correction?: CorrectionRequestDto | null): Application {
  const status = d.status === 'APPROVED' ? 'approved' : d.status === 'REJECTED' || d.status === 'CHANGES_REQUESTED' ? 'rejected' : 'pending';
  const submittedAt = ms(d.submittedAt) ?? 0;
  const items = correction?.items.map(i => ({ field: FIELD_LABEL[i.field] ?? i.field, reason: i.reason }))
    ?? (d.status === 'REJECTED' ? [{ field: '입점 심사', reason: d.rejectionReason ?? '' }] : undefined);
  return {
    id: d.applicationId, userId, displayName: d.sellerDisplayName ?? '', name: d.contactName, email: d.contactEmail, phone: d.contactPhone,
    document: { id: SERVER_DOC + d.applicationId, name: '사업자등록증.pdf', size: 0, uploadedAt: submittedAt },
    bank: d.bankName, account: d.maskedBankAccount, shippingAddress: addrLine(d.dispatchAddress), returnAddress: addrLine(d.returnAddress),
    status, submittedAt, reviewedAt: ms(d.reviewedAt), approvedAt: status === 'approved' ? ms(d.reviewedAt) : undefined, // 추측(명세 없음): 승인 시각 = reviewedAt
    rejectedAt: status === 'rejected' ? ms(d.reviewedAt) : undefined, deadlineAt: ms(correction?.deadline), rejectionItems: items,
  };
}
/** 본인 신청을 store에 반영(있으면 교체, 없으면 추가). 서버에 없는 사업자 정보는 기존 값 유지 */
export function mergeApplication(s: State, app: Application | null) {
  if (!app) return;
  const i = s.applications.findIndex(a => a.userId === app.userId);
  if (i >= 0) s.applications[i] = { ...app, business: s.applications[i].business, salesUrl: s.applications[i].salesUrl }; else s.applications.unshift(app);
}
/** GET /sellers/me → 화면 설정(주소 상세는 shippingDetail/returnDetail에 보관해 저장 때 지워지지 않게 한다) */
export function sellerSettingsFromApi(d: SellerProfileDto, prev?: SellerSettings): SellerSettings {
  return {
    notifications: {}, ...prev, displayName: d.sellerDisplayName, bank: d.bankAccount.bankName, account: d.bankAccount.maskedBankAccount, holder: d.bankAccount.accountHolderName ?? '',
    shippingAddress: d.dispatchAddress.roadAddress, shippingPostal: d.dispatchAddress.postalCode, shippingDetail: d.dispatchAddress.detailAddress ?? '',
    returnAddress: d.returnAddress.roadAddress, returnPostal: d.returnAddress.postalCode, returnDetail: d.returnAddress.detailAddress ?? '',
  };
}

/* ── 입점 신청 (구매자 JWT) ── */
export interface ApplicationInput { displayName: string; name: string; email: string; phone: string; bank: string; account: string; shippingPostal: string; shippingAddress: string; returnPostal: string; returnAddress: string }
const jsonPart = (v: unknown) => new Blob([JSON.stringify(v)], { type: 'application/json' });
const addr = (postalCode: string, roadAddress: string, detailAddress?: string) => ({ postalCode, roadAddress, detailAddress: detailAddress || undefined });

/** POST /v1/seller-applications — multipart: `application`(JSON) + `certificate`(PDF). 201 {applicationId,status} */
export function submitApplication(f: ApplicationInput, pdf: Blob, fileName: string) {
  const fd = new FormData();
  fd.append('application', jsonPart({
    sellerDisplayName: f.displayName.trim() || undefined, contactName: f.name, contactEmail: f.email, contactPhone: f.phone, bankName: f.bank, bankAccountNumber: f.account.replace(/-/g, ''),
    dispatchAddress: addr(f.shippingPostal, f.shippingAddress), returnAddress: addr(f.returnPostal, f.returnAddress),
  }));
  fd.append('certificate', pdf, fileName);
  return api.upload<{ applicationId: string; status: string }>('POST', APPS, fd, { service: account });
}
/** GET /seller-applications/{id}/correction-request */
export const fetchCorrectionRequest = (id: string, signal?: AbortSignal) => api.get<CorrectionRequestDto>(`${APPS}/${enc(id)}/correction-request`, { service: account, signal });
/** GET /seller-applications/me — 신청이 없으면(404 SELLER_APPLICATION_NOT_FOUND) null. 보완 요청 중이면 보완 항목·기한도 함께 읽는다 */
export async function fetchMyApplication(userId: string, signal?: AbortSignal): Promise<Application | null> {
  let d: SellerApplicationDto;
  try { d = await api.get<SellerApplicationDto>(`${APPS}/me`, { service: account, signal }); }
  catch (e) { if (e instanceof ApiError && e.code === 'SELLER_APPLICATION_NOT_FOUND') return null; throw e; }
  const correction = d.status === 'CHANGES_REQUESTED' ? await fetchCorrectionRequest(d.applicationId, signal) : null;
  return applicationFromApi(d, userId, correction);
}
/** GET /seller-applications/me/history — 없으면 [] */
export async function fetchApplicationHistory(userId: string, signal?: AbortSignal): Promise<Application[]> {
  return (await api.get<SellerApplicationDto[]>(`${APPS}/me/history`, { service: account, signal })).map(d => applicationFromApi(d, userId));
}
/** GET /seller-applications/{id} */
export async function fetchApplication(id: string, userId: string, signal?: AbortSignal): Promise<Application> {
  return applicationFromApi(await api.get<SellerApplicationDto>(`${APPS}/${enc(id)}`, { service: account, signal }), userId);
}
/** GET /seller-applications/{id}/certificate — PDF 바이너리 */
export const fetchApplicationCertificate = (id: string, signal?: AbortSignal) => api.get<Blob>(`${APPS}/${enc(id)}/certificate`, { service: account, signal, responseType: 'blob' });
/** POST /seller-applications/{id}/resubmissions — 운영자가 요청한 항목만. contact는 CONTACT 요청 시, certificate는 CERTIFICATE 요청 시. 추측(명세 없음): {id}는 applicationId, application 파트는 contact가 있을 때만 보낸다 */
export function resubmitApplication(id: string, o: { contact?: { name: string; email: string; phone: string }; certificate?: Blob; fileName?: string }) {
  const fd = new FormData();
  if (o.contact) fd.append('application', jsonPart({ contact: o.contact }));
  if (o.certificate) fd.append('certificate', o.certificate, o.fileName ?? 'business-registration.pdf');
  return api.upload<{ applicationId: string; status: string }>('POST', `${APPS}/${enc(id)}/resubmissions`, fd, { service: account });
}

/* ── 판매자 정보·재심사 ── */
/** GET /sellers/me */
export async function fetchSellerMe(prev?: SellerSettings, signal?: AbortSignal) {
  const d = await api.get<SellerProfileDto>(ME, { service: account, signal });
  return { settings: sellerSettingsFromApi(d, prev), contactPhone: d.contactPhone, contactEmail: d.contactEmail };
}
/** PUT /sellers/me/contact */
export const updateSellerContact = (b: { sellerDisplayName?: string; contactName: string; contactEmail: string; contactPhone: string }) =>
  api.put<null>(`${ME}/contact`, { ...b, sellerDisplayName: b.sellerDisplayName?.trim() || undefined }, { service: account });
/** PUT /sellers/me/bank-account — 필드명은 bankAccountNumber(하이픈 제거) */
export const updateSellerBank = (f: Pick<SellerSettings, 'bank' | 'account' | 'holder'>) =>
  api.put<null>(`${ME}/bank-account`, { bankName: f.bank, bankAccountNumber: f.account.replace(/-/g, ''), accountHolderName: f.holder }, { service: account });
/** PUT /sellers/me/addresses — 출고·반품 동시 변경(기존 호환 API) */
export const updateSellerAddresses = (f: SellerSettings) =>
  api.put<null>(`${ME}/addresses`, { dispatchAddress: addr(f.shippingPostal ?? '', f.shippingAddress, f.shippingDetail), returnAddress: addr(f.returnPostal ?? '', f.returnAddress, f.returnDetail) }, { service: account });
/** POST /sellers/me/certificate-reviews — 사업자등록증 재심사 신청(BUYER JWT). 화면 없음(TODO(api-gap)) */
export function requestCertificateReview(pdf: Blob, fileName = 'business-registration.pdf') {
  const fd = new FormData(); fd.append('certificate', pdf, fileName);
  return api.upload<{ applicationId: string; status: string }>('POST', `${ME}/certificate-reviews`, fd, { service: account });
}
/** GET /sellers/me/review-status (BUYER JWT) — 화면 없음 */
export const fetchReviewStatus = (signal?: AbortSignal) => api.get<{ salesRestricted: boolean; application: SellerApplicationDto; correction: CorrectionRequestDto | null }>(`${ME}/review-status`, { service: account, signal });

/* ── 주소록 (화면 없음: 현재 화면은 출고·반품 한 쌍만 편집 — TODO(api-gap)) ── */
export type AddressType = 'DISPATCH' | 'RETURN';
export type AddressBookBody = Pick<SellerAddressBookDto, 'label' | 'contactName' | 'contactPhone' | 'address'>;
const book = (t: AddressType) => `${ME}/address-book/${t}`;
export const listAddressBook = (t: AddressType, signal?: AbortSignal) => api.get<SellerAddressBookDto[]>(book(t), { service: account, signal });
export const createAddressBook = (t: AddressType, b: AddressBookBody) => api.post<SellerAddressBookDto>(book(t), b, { service: account });
export const fetchAddressBook = (t: AddressType, id: string, signal?: AbortSignal) => api.get<SellerAddressBookDto>(`${book(t)}/${enc(id)}`, { service: account, signal });
export const updateAddressBook = (t: AddressType, id: string, b: AddressBookBody) => api.put<SellerAddressBookDto>(`${book(t)}/${enc(id)}`, b, { service: account });
/** DELETE — 기본 주소면 409 SELLER_DEFAULT_ADDRESS_REQUIRED */
export const deleteAddressBook = (t: AddressType, id: string) => api.delete<null>(`${book(t)}/${enc(id)}`, { service: account });
export const setDefaultAddressBook = (t: AddressType, id: string) => api.put<null>(`${book(t)}/${enc(id)}/default`, undefined, { service: account });

/* ── 스토어 ── */
export const fetchSellerStore = (signal?: AbortSignal) => api.get<SellerStoreDto>(`${ME}/store`, { service: account, signal });
/** PUT /sellers/me/store — 소개는 공백 제거 후 ≤40자(빈 문자열 허용) */
export const updateSellerStore = (introduction: string) => api.put<SellerStoreDto>(`${ME}/store`, { introduction: introduction.trim() }, { service: account });
/** GET /sellers/me/store/logo — 이미지 바이너리(없으면 404 SELLER_LOGO_NOT_FOUND) */
export const fetchSellerLogo = (signal?: AbortSignal) => api.get<Blob>(`${ME}/store/logo`, { service: account, signal, responseType: 'blob' });
/** POST /sellers/me/store/logo — multipart `image`(JPEG/PNG ≤2MiB). 서버 검증 전에 같은 조건을 먼저 확인한다 */
export async function uploadSellerLogo(file: File) {
  if (!['image/jpeg', 'image/png'].includes(file.type)) throw new Error('JPG 또는 PNG 이미지를 선택해 주세요.');
  if (file.size > 2 * 1024 * 1024) throw new Error('로고 이미지는 2MB 이하여야 해요.');
  const fd = new FormData(); fd.append('image', file);
  return api.upload<SellerStoreDto>('POST', `${ME}/store/logo`, fd, { service: account });
}
export const deleteSellerLogo = () => api.delete<null>(`${ME}/store/logo`, { service: account });
