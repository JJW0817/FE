/**
 * 운영자 도메인 16개 — 명세 docs/api-spec.md 10절. 모두 ADMIN JWT.
 * 입점 심사 8개=Account service(`account`), 상품 심사 8개=PurchaseGateway(`purchase`).
 * 응답은 화면 타입(Application/Product)으로 바꿔 돌려준다. 실제 모드 전용(mock 모드는 화면이 기존 로컬 동작을 쓴다).
 * 사업자 정보(상호·대표자 등)와 판매 URL은 API에 없어 mock 표시 그대로 둔다 (TODO(api-gap)).
 */
import type { Application, Product, State } from '../domain';
import { api } from './client';
import { applicationFromApi } from './seller';
import { sellerProductFromApi, sellerProductFromListItem } from './sellerProducts';
import type { ApplicationStatus, CorrectionField, CorrectionRequestDto, ItemsPage, ProductImageMetaDto, ProductReviewListItemDto, ProductRevisionDto, ProductStatus, SellerApplicationDto, SellerProductDto } from './types';

const account = 'account' as const, purchase = 'purchase' as const;
const enc = encodeURIComponent;
const APPS = '/v1/admin/seller-applications';
const REVIEWS = '/v1/admin/product-reviews';

/* ── 입점 심사 ── */
/** GET …/seller-applications — status 생략=전체. 화면 Application(userId=accountId) */
export async function listAdminApplications(q: { status?: ApplicationStatus; page?: number; size?: number } = {}, signal?: AbortSignal): Promise<Application[]> {
  const r = await api.get<{ content: SellerApplicationDto[] }>(APPS, { service: account, signal, query: { size: 100, ...q } });
  return r.content.map(d => applicationFromApi(d, d.accountId));
}
/** GET …/seller-applications/{id} */
export async function getAdminApplication(id: string, signal?: AbortSignal): Promise<Application> {
  const d = await api.get<SellerApplicationDto>(`${APPS}/${enc(id)}`, { service: account, signal });
  return applicationFromApi(d, d.accountId);
}
/** POST …/certificate-review — PDF를 돌려주며 열람 기록을 남긴다. 승인 전에 먼저 불러야 한다(아니면 409 SELLER_CERTIFICATE_REVIEW_REQUIRED) */
export const reviewCertificate = (id: string) => api.post<Blob>(`${APPS}/${enc(id)}/certificate-review`, undefined, { service: account, responseType: 'blob' });
export const approveSellerApplication = (id: string) => api.post<null>(`${APPS}/${enc(id)}/approve`, undefined, { service: account });
/** reason: 공백 불가 ≤1000 */
export const rejectSellerApplication = (id: string, reason: string) => api.post<null>(`${APPS}/${enc(id)}/reject`, { reason: reason.trim() }, { service: account });
export const getCorrectionRequest = (id: string, signal?: AbortSignal) => api.get<CorrectionRequestDto>(`${APPS}/${enc(id)}/correction-request`, { service: account, signal });
/** deadline: 미래 시각(ISO UTC로 보냄), items 1~6개·field 중복 불가. TODO(api-gap): 화면 없음(현재 반려 UI는 단일 사유 → reject) */
export const requestCorrection = (id: string, deadline: Date, items: { field: CorrectionField; reason: string }[]) =>
  api.post<CorrectionRequestDto>(`${APPS}/${enc(id)}/correction-request`, { deadline: deadline.toISOString(), items }, { service: account });
/** 목록·상세 결과를 store에 반영(있으면 교체하되 서버에 없는 사업자 정보·판매 URL은 유지) */
export function mergeAdminApplications(s: State, items: Application[]) {
  for (const a of items) {
    const i = s.applications.findIndex(x => x.id === a.id);
    if (i < 0) s.applications.push(a); else s.applications[i] = { ...a, business: s.applications[i].business, salesUrl: s.applications[i].salesUrl };
  }
}
/** 승인·반려 직후 store 반영 */
export function markApplication(s: State, id: string, status: 'approved' | 'rejected', now: number, reason = '') {
  const a = s.applications.find(x => x.id === id); if (!a) return;
  a.status = status; a.reviewedAt = now;
  if (status === 'approved') a.approvedAt = now; else { a.rejectedAt = now; a.rejectionItems = [{ field: '입점 심사', reason }]; }
}

/* ── 상품 심사 ── */
/** GET …/product-reviews — 최초 심사 목록(`items`). 기본 IN_REVIEW. 목록에는 가격·옵션이 없다 */
export async function listAdminProductReviews(status: ProductStatus = 'IN_REVIEW', signal?: AbortSignal): Promise<Product[]> {
  const r = await api.get<ItemsPage<ProductReviewListItemDto>>(REVIEWS, { service: purchase, signal, query: { status, size: 100 } });
  return r.items.map(d => sellerProductFromListItem(d, '')); // 목록에 sellerId 없음 → 상세에서 채워짐
}
/** 목록 항목을 store에 반영: 이미 상세로 채운 가격·옵션 등은 0으로 덮지 않고 이름·상태·일정·version만 갱신 */
export function mergeAdminProductList(s: State, items: Product[]) {
  for (const p of items) {
    const i = s.products.findIndex(x => x.id === p.id);
    if (i < 0) s.products.push(p);
    else { const o = s.products[i]; s.products[i] = { ...o, name: p.name, published: p.published, startsAt: p.startsAt, endsAt: p.endsAt, version: p.version, reviewStatus: p.reviewStatus, rejectionReason: p.reviewStatus === 'REJECTED' ? o.rejectionReason || '반려됨' : undefined }; }
  }
}
/** GET …/product-reviews/{id} — 상품 원본(version 포함) */
export async function getAdminProductReview(id: string, signal?: AbortSignal): Promise<Product> {
  return sellerProductFromApi(await api.get<SellerProductDto>(`${REVIEWS}/${enc(id)}`, { service: purchase, signal }));
}
export const listAdminProductImages = (id: string, signal?: AbortSignal) => api.get<ProductImageMetaDto[]>(`${REVIEWS}/${enc(id)}/images`, { service: purchase, signal });
export async function getAdminProductImageUrl(id: string, imageId: string, signal?: AbortSignal): Promise<string> {
  return (await api.get<{ downloadUrl: string }>(`${REVIEWS}/${enc(id)}/images/${enc(imageId)}/download-url`, { service: purchase, signal })).downloadUrl;
}
/** 상세 + 이미지(열람 URL, 위치순). 한 장 URL 발급이 실패해도 나머지는 보여 준다 */
export async function getAdminProductReviewWithImages(id: string, signal?: AbortSignal): Promise<Product> {
  const [p, metas] = await Promise.all([getAdminProductReview(id, signal), listAdminProductImages(id, signal)]);
  const sorted = [...metas].sort((a, b) => a.position - b.position);
  const urls = await Promise.all(sorted.map(m => getAdminProductImageUrl(id, m.id, signal).catch(() => '')));
  return { ...p, images: urls, imageIds: sorted.map(m => m.id) };
}
/** POST …/decisions — expectedVersion=조회한 version(불일치 409 PRODUCT_STATE). 반려는 reason 필수 ≤2000. 결과 Product */
export async function decideProductReview(id: string, expectedVersion: number, approved: boolean, reason?: string): Promise<Product> {
  if (!approved && !reason?.trim()) throw new Error('반려 사유를 입력해 주세요.');
  return sellerProductFromApi(await api.post<SellerProductDto>(`${REVIEWS}/${enc(id)}/decisions`, { expectedVersion, approved, reason: approved ? undefined : reason!.trim() }, { service: purchase }));
}

/* ── 상품 수정 심사 (TODO(api-gap): 화면 없음 — 승인 상품 수정 심사 목록·상세 화면이 없어 함수만 둔다) ── */
/** GET …/revisions — data 자체가 배열(페이징 메타 없음) */
export const listAdminRevisions = (status: 'IN_REVIEW' | 'APPROVED' | 'REJECTED' = 'IN_REVIEW', signal?: AbortSignal) =>
  api.get<ProductRevisionDto[]>(`${REVIEWS}/revisions`, { service: purchase, signal, query: { status } });
export const getAdminRevision = (productId: string, revisionId: string, signal?: AbortSignal) =>
  api.get<ProductRevisionDto>(`${REVIEWS}/${enc(productId)}/revisions/${enc(revisionId)}`, { service: purchase, signal });
/** expectedVersion=수정 심사 회차(revision) version, 상품 version이 아니다 */
export const decideRevision = (productId: string, revisionId: string, expectedVersion: number, approved: boolean, reason?: string) =>
  api.post<ProductRevisionDto>(`${REVIEWS}/${enc(productId)}/revisions/${enc(revisionId)}/decisions`, { expectedVersion, approved, reason: approved ? undefined : reason?.trim() }, { service: purchase });
export async function getAdminRevisionImageUrl(productId: string, revisionId: string, imageId: string, signal?: AbortSignal): Promise<string> {
  return (await api.get<{ downloadUrl: string }>(`${REVIEWS}/${enc(productId)}/revisions/${enc(revisionId)}/images/${enc(imageId)}/download-url`, { service: purchase, signal })).downloadUrl;
}
