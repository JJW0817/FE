/**
 * 판매자 도메인(2/2) 상품 — 명세 docs/api-spec.md 8절(상품 관리·등록 26개) + 11절(AI 분석 조회 1개).
 * 상품 Command=PurchaseGateway(`purchase`), AI 분석 조회=일반 Gateway(`general`). 모두 SELLER JWT.
 * 응답(SellerProduct)은 화면의 Product로 바꿔 돌려준다. 낙관적 잠금 version은 Product.version으로 들고 다니며,
 * 등록 단계 PUT은 매번 응답의 새 version을 다음 요청에 넘긴다(submitListing).
 * 실제 모드 전용: mock 모드는 화면이 기존 로컬 동작(publishDraft 등)을 그대로 쓴다.
 */
import type { Draft, Inquiry, Product } from '../domain';
import { optionKey } from '../domain';
import { ApiError, api } from './client';
import { ms } from './mappers';
import { errorMessage } from './errors';
import type { AiAnalysisAcceptedDto, AiAnalysisDto, ProductImageMetaDto, ProductImageUploadDto, ProductRevisionDto, ProductReviewListItemDto, ProductSalesSummaryDto, RegistrationMetadataDto, SellerProductDto, SellerProductInquiryDto, ItemsPage } from './types';

const general = 'general' as const, purchase = 'purchase' as const;
const enc = encodeURIComponent;
const P = '/v1/seller/products';
const at = (id: string) => `${P}/${enc(id)}`;
const iso = (t: number) => new Date(t).toISOString();

/* ── 변환 ── */
/** SellerProduct(편집 원본) → Product. 이미지는 별도 API라 비워 두고(merge가 기존 값 유지), 옵션 stock은 최초 수량 */
export function sellerProductFromApi(d: SellerProductDto): Product {
  return {
    id: d.id, sellerId: d.sellerId, name: d.name ?? '', brand: d.brandOrStore ?? '', category: d.category ?? '', description: d.description ?? '', images: [], originalUrl: d.sourceUrl ?? '',
    price: d.price ?? 0, shipping: d.shippingFee ?? 0, maxPerAccount: d.perAccountLimit ?? 0, dispatchDays: d.dispatchBusinessDays ?? 0, startsAt: ms(d.startsAt) ?? 0, endsAt: ms(d.endsAt) ?? 0,
    published: d.status === 'APPROVED', options: d.options.map(o => ({ id: o.id, name: o.label, stock: o.initialQuantity })),
    dimensions: d.optionDimensions.map(x => ({ name: x.name, values: x.values.join(', ') })), extras: d.attributes.map(a => ({ key: a.name, value: a.value })), reason: d.disposalReason ?? '',
    faqs: d.faqs.map(f => ({ id: f.id, question: f.question, answer: f.answer, confirmed: true })),
    rejectionReason: d.status === 'REJECTED' ? (d.reviewReason ?? '') : undefined, version: d.version, reviewStatus: d.status,
  };
}
/** 관리 목록 항목 → Product. 목록에는 가격·옵션·이미지가 없다(TODO(api-gap): 목록 카드의 가격·수량은 상세를 열어야 채워짐) */
export function sellerProductFromListItem(d: ProductReviewListItemDto, sellerId: string): Product {
  return {
    id: d.id, sellerId, name: d.name, brand: '', category: '', description: '', images: [], originalUrl: '', price: 0, shipping: 0, maxPerAccount: 0, dispatchDays: 0,
    startsAt: ms(d.startsAt) ?? 0, endsAt: ms(d.endsAt) ?? 0, published: d.status === 'APPROVED', options: [], dimensions: [], extras: [], reason: '', faqs: [], version: d.version, reviewStatus: d.status,
  };
}
/** 상품 문의(판매자 시점) → Inquiry. userId=구매자, 상품명은 merge가 상품에서 채운다 */
export function sellerProductInquiryFromApi(d: SellerProductInquiryDto, sellerId: string): Inquiry {
  return { id: d.id, userId: d.buyerId, sellerId, productId: d.productId, productName: '', kind: '상품 문의', question: d.question, answer: d.answer ?? undefined, public: false, createdAt: Date.parse(d.createdAt), version: d.version };
}

/* ── 목록·집계·메타 ── */
export interface SellerProductQuery { status?: 'DRAFT' | 'IN_REVIEW' | 'REJECTED' | 'APPROVED'; month?: string; saleState?: 'SCHEDULED' | 'ON_SALE' | 'ENDED'; page?: number; size?: number }
/** GET /v1/seller/products — 본인 상품 관리 목록(`items`) */
export async function listSellerProducts(sellerId: string, q: SellerProductQuery = {}, signal?: AbortSignal): Promise<Product[]> {
  const r = await api.get<ItemsPage<ProductReviewListItemDto>>(P, { service: purchase, signal, query: { size: 100, ...q } });
  return r.items.map(d => sellerProductFromListItem(d, sellerId));
}
/** POST /v1/seller/products — 등록 초안 생성(201, 본문 없음) */
export const createProductDraft = async () => sellerProductFromApi(await api.post<SellerProductDto>(P, undefined, { service: purchase }));
/** GET /v1/seller/products/registration-metadata — 카테고리 이름 목록과 AI 점검 기준 */
export const getRegistrationMetadata = (signal?: AbortSignal) => api.get<RegistrationMetadataDto>(`${P}/registration-metadata`, { service: purchase, signal });
/** GET /v1/seller/products/sales-summary — 판매·재고 집계(매출·정산 없음) */
export const getSalesSummary = (month?: string, signal?: AbortSignal) => api.get<ProductSalesSummaryDto>(`${P}/sales-summary`, { service: purchase, signal, query: { month } });
/** GET /v1/seller/products/{id} — 편집 원본(version 포함). 이미지는 getSellerProductWithImages */
export async function getSellerProduct(id: string, signal?: AbortSignal): Promise<Product> {
  return sellerProductFromApi(await api.get<SellerProductDto>(at(id), { service: purchase, signal }));
}

/* ── 이미지 (권한 발급 → S3 PUT → 완료 확인) ── */
/** GET …/images — 위치순 이미지 메타 */
export const listProductImages = (id: string, signal?: AbortSignal) => api.get<ProductImageMetaDto[]>(`${at(id)}/images`, { service: purchase, signal });
/** GET …/images/{imageId}/download-url — 5분 유효 열람 URL */
export async function getProductImageUrl(id: string, imageId: string, signal?: AbortSignal): Promise<string> {
  return (await api.get<{ downloadUrl: string }>(`${at(id)}/images/${enc(imageId)}/download-url`, { service: purchase, signal })).downloadUrl;
}
/** PUT …/images — 순서(imageIds)와 대표(representativeId) 변경 */
export const reorderProductImages = (id: string, imageIds: string[], representativeId: string) =>
  api.put<ProductImageMetaDto[]>(`${at(id)}/images`, { imageIds, representativeId }, { service: purchase });
/** DELETE …/images/{imageId} — 연결 해제 */
export const deleteProductImage = (id: string, imageId: string) => api.delete<null>(`${at(id)}/images/${enc(imageId)}`, { service: purchase });
/** 상품 + 이미지(열람 URL, 위치순) + imageIds. 상세·편집 화면용 */
export async function getSellerProductWithImages(id: string, signal?: AbortSignal): Promise<Product> {
  const [p, metas] = await Promise.all([getSellerProduct(id, signal), listProductImages(id, signal)]);
  const sorted = [...metas].sort((a, b) => a.position - b.position);
  const urls = await Promise.all(sorted.map(m => getProductImageUrl(id, m.id, signal).catch(() => '')));
  return { ...p, images: urls, imageIds: sorted.map(m => m.id) };
}
/** 이미지 한 장 업로드 3단계 → 서버 imageId와 열람 URL. S3 PUT은 Authorization 없이 정확한 Content-Type으로 보내므로 fetch를 쓴다 */
export async function uploadProductImage(id: string, file: File, putFetch: typeof fetch = (u, i) => fetch(u, i)): Promise<{ id: string; url: string }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('JPG·PNG·WEBP 이미지만 올릴 수 있어요.');
  if (file.size < 1 || file.size > 10 * 1024 * 1024) throw new Error('사진은 10MB 이하여야 해요.');
  const g = await api.post<ProductImageUploadDto>(`${at(id)}/image-uploads`, { contentType: file.type, sizeBytes: file.size }, { service: purchase });
  const r = await putFetch(g.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!r.ok) { await deleteProductImage(id, g.imageId).catch(() => {}); throw new Error('사진을 올리지 못했어요. 다시 시도해 주세요.'); }
  await api.post<ProductImageMetaDto>(`${at(id)}/images/${enc(g.imageId)}/completion`, undefined, { service: purchase });
  return { id: g.imageId, url: await getProductImageUrl(id, g.imageId).catch(() => '') };
}

/* ── 등록 단계별 저장 (각 단계는 해당 값 전체 교체, expectedVersion 필수, 응답의 새 version을 다음에 쓴다) ── */
const step = async (id: string, name: string, body: object) => sellerProductFromApi(await api.put<SellerProductDto>(`${at(id)}/registration/${name}`, body, { service: purchase }));
export const saveBasicInfo = (id: string, expectedVersion: number, b: { name?: string; description?: string; brandOrStore?: string; category?: string; sourceUrl?: string }) => step(id, 'basic-info', { expectedVersion, ...b });
export const saveDetails = (id: string, expectedVersion: number, b: { attributes: { name: string; value: string }[]; disposalReason?: string }) => step(id, 'details', { expectedVersion, ...b });
export interface OptionVariant { id?: string; selections: Record<string, string>; initialQuantity: number }
export const saveOptions = (id: string, expectedVersion: number, b: { dimensions: { name: string; values: string[] }[]; variants: OptionVariant[] }) => step(id, 'options', { expectedVersion, ...b });
export interface PricingShipping { price?: number; shippingFee?: number; dispatchBusinessDays?: number; perAccountLimit?: number; shippingNotice?: string; purchaseNotice?: string; dispatchAddressId?: string; returnAddressId?: string }
/** 출고지·반품지 id를 생략하면 서버가 기본 주소를 쓴다 */
export const savePricingShipping = (id: string, expectedVersion: number, b: PricingShipping) => step(id, 'pricing-shipping', { expectedVersion, ...b });
/** startsAt: ISO. null이면 일정 삭제. 종료=시작+3시간은 서버가 계산 */
export const saveSchedule = (id: string, expectedVersion: number, startsAt: string | null) => step(id, 'schedule', { expectedVersion, startsAt });
export interface FaqInput { id?: string; question: string; answer: string; suggestionId?: string }
/** 6단계: FAQ 전체 저장(빈 배열=전체 제거). confirmed=true만 저장된다 */
export const saveRegistrationFaqs = (id: string, expectedVersion: number, faqs: FaqInput[]) => step(id, 'faqs', { expectedVersion, faqs: faqs.map(f => ({ ...f, confirmed: true })) });
/** POST …/review-submissions — 최초 심사 제출(DRAFT/REJECTED) */
export const submitReview = async (id: string, expectedVersion: number) => sellerProductFromApi(await api.post<SellerProductDto>(`${at(id)}/review-submissions`, { expectedVersion }, { service: purchase }));

/* ── FAQ 개별 (화면 없음: 등록 화면에 FAQ 입력 UI가 없어 호출처 없음 — 문의 답변의 publishToFaq가 FAQ 반영 경로) ── */
const faqBody = (expectedVersion: number, f: FaqInput) => ({ expectedVersion, faq: { ...f, confirmed: true } });
export const addProductFaq = async (id: string, expectedVersion: number, f: FaqInput) => sellerProductFromApi(await api.post<SellerProductDto>(`${at(id)}/faqs`, faqBody(expectedVersion, f), { service: purchase }));
export const updateProductFaq = async (id: string, faqId: string, expectedVersion: number, f: FaqInput) => sellerProductFromApi(await api.put<SellerProductDto>(`${at(id)}/faqs/${enc(faqId)}`, faqBody(expectedVersion, f), { service: purchase }));
/** DELETE — expectedVersion은 query, 응답은 200 + 상품 전체 */
export const deleteProductFaq = async (id: string, faqId: string, expectedVersion: number) => sellerProductFromApi(await api.delete<SellerProductDto>(`${at(id)}/faqs/${enc(faqId)}`, { service: purchase, query: { expectedVersion } }));

/* ── 수정 심사(승인 상품) ── */
export interface RevisionInput { name: string; description: string; imageIds: string[]; representativeId: string; shippingFee: number; dispatchBusinessDays: number; shippingNotice?: string; purchaseNotice?: string; startsAt: string; dispatchAddressId?: string; returnAddressId?: string }
/** GET …/revisions — data 자체가 배열 */
export const listRevisions = (id: string, signal?: AbortSignal) => api.get<ProductRevisionDto[]>(`${at(id)}/revisions`, { service: purchase, signal });
/** POST …/revisions — expectedVersion은 원본 상품 version. 201 + ProductRevision(IN_REVIEW) */
export const submitRevision = (id: string, expectedVersion: number, b: RevisionInput) => api.post<ProductRevisionDto>(`${at(id)}/revisions`, { expectedVersion, ...b }, { service: purchase });

/* ── AI 분석 ── */
/** POST …/ai-analyses — 202 접수. 같은 입력의 완료 분석이 있으면 completed=true */
export const requestAiAnalysis = (id: string, expectedVersion: number) => api.post<AiAnalysisAcceptedDto>(`${at(id)}/ai-analyses`, { expectedVersion }, { service: purchase });
/** GET /v1/ai/product-analyses/{requestId} — 상품 id가 아니라 requestId. 완료 전 result=null, RETRY는 실패가 아니다 */
export const getAiAnalysis = (requestId: string, signal?: AbortSignal) => api.get<AiAnalysisDto>(`/v1/ai/product-analyses/${enc(requestId)}`, { service: general, signal });
const sleep = (t: number) => new Promise(r => setTimeout(r, t));
/** 완료(COMPLETED)까지 폴링. 추측(명세 없음): 2초 간격 최대 30회. 이벤트 지연으로 생기는 404 AI_NOT_FOUND는 재시도한다 */
export async function pollAiAnalysis(requestId: string, o: { interval?: number; tries?: number; signal?: AbortSignal } = {}): Promise<NonNullable<AiAnalysisDto['result']>> {
  for (let i = 0; i < (o.tries ?? 30); i++) {
    try { const r = await getAiAnalysis(requestId, o.signal); if (r.status === 'COMPLETED' && r.result) return r.result; }
    catch (e) { if (!(e instanceof ApiError && e.code === 'AI_NOT_FOUND')) throw e; }
    await sleep(o.interval ?? 2000);
  }
  throw new Error('AI 분석이 지연되고 있어요. 잠시 후 다시 시도해 주세요.');
}

/* ── 문의 답변 ── */
/** GET /v1/seller/products/inquiries — 본인 상품 문의함(`items`) */
export async function listSellerProductInquiries(sellerId: string, q: { productId?: string; unanswered?: boolean } = {}, signal?: AbortSignal): Promise<Inquiry[]> {
  const r = await api.get<ItemsPage<SellerProductInquiryDto>>(`${P}/inquiries`, { service: purchase, signal, query: { size: 100, ...q } });
  return r.items.map(d => sellerProductInquiryFromApi(d, sellerId));
}
/** PUT …/{productId}/inquiries/{inquiryId}/answer — expectedVersion은 문의 version. publishToFaq=true면 FAQ도 갱신 */
export async function answerProductInquiry(sellerId: string, productId: string, inquiryId: string, b: { expectedVersion: number; answer: string; publishToFaq?: boolean }): Promise<Inquiry> {
  const d = await api.put<SellerProductInquiryDto>(`${at(productId)}/inquiries/${enc(inquiryId)}/answer`, { publishToFaq: false, ...b }, { service: purchase });
  return { ...sellerProductInquiryFromApi(d, sellerId), public: !!b.publishToFaq };
}

/* ── 화면 초안(Draft) → 서버 단계 값 ── */
/** 옵션 축·수량 → 서버 dimensions/variants. 수량 0인 조합은 보내지 않고(≥1 필수), 차원 값도 쓰이는 값만 보낸다 */
export function optionPayload(d: Draft) {
  const axes = d.axes ?? { size: false, color: false }, colors = d.colors ?? [], sizes = d.sizes ?? [], stock = d.stock ?? {};
  type Row = { name: string; selections: Record<string, string>; qty: number };
  const rows: Row[] = axes.color && axes.size ? colors.flatMap(c => sizes.map(s => ({ name: `${c} / ${s}`, selections: { 색상: c, 사이즈: s }, qty: stock[optionKey(c, s)] ?? 0 })))
    : axes.color ? colors.map(c => ({ name: c, selections: { 색상: c }, qty: stock[optionKey(c, '')] ?? 0 }))
    : axes.size ? sizes.map(s => ({ name: s, selections: { 사이즈: s }, qty: stock[optionKey('', s)] ?? 0 }))
    : [{ name: '기본', selections: { 옵션: '기본' }, qty: stock[optionKey('', '')] ?? 0 }]; // 추측(명세 없음): 옵션 없음 = 차원 '옵션' 값 '기본' 하나
  const used = rows.filter(r => r.qty >= 1);
  const dimensions = [...new Set(used.flatMap(r => Object.keys(r.selections)))].map(name => ({ name, values: [...new Set(used.map(r => r.selections[name]))] }));
  // 서버가 준 옵션 id만 유지(화면이 만든 임시 id `opt-…`는 새 옵션)
  const variants: OptionVariant[] = used.map(r => { const old = d.options.find(o => o.name === r.name)?.id; return { ...(old && !old.startsWith('opt-') ? { id: old } : {}), selections: r.selections, initialQuantity: r.qty }; });
  return { dimensions, variants };
}
/** 기본 정보 단계 값. 추측(명세 없음): 화면에 설명·처분 사유 입력란이 없어 설명=상품명, 처분 사유=기본 문구로 채운다 */
export function basicInfoOf(d: Draft, categories?: string[]) {
  return { name: d.name.trim() || undefined, description: d.description.trim() || undefined, brandOrStore: d.brand.trim() || undefined, sourceUrl: d.originalUrl.trim() ? (/^https?:\/\//.test(d.originalUrl.trim()) ? d.originalUrl.trim() : `https://${d.originalUrl.trim()}`) : undefined,
    category: d.category && (!categories || categories.includes(d.category)) ? d.category : undefined };
}
const startIso = (d: Draft) => iso(new Date(d.startsAt).getTime());
const detailsOf = (d: Draft) => ({ attributes: d.extras.filter(e => e.key.trim() && e.value.trim()).map(e => ({ name: e.key.trim(), value: e.value.trim() })), disposalReason: d.reason.trim() || undefined });
/** 서버에 이미 같은 값이 저장돼 있는지(같으면 저장 요청을 건너뛴다) */
export const sameBasic = (b: ReturnType<typeof basicInfoOf>, p: Product) => (b.name ?? '') === p.name && (b.description ?? '') === p.description && (b.brandOrStore ?? '') === p.brand && (b.sourceUrl ?? '') === p.originalUrl && (b.category ?? '') === p.category;
export const sameDetails = (x: ReturnType<typeof detailsOf>, p: Product) => (x.disposalReason ?? '') === p.reason && JSON.stringify(x.attributes) === JSON.stringify(p.extras.map(e => ({ name: e.key, value: e.value })));

/**
 * 등록 화면 제출(실제 모드): 최신 version을 읽고 → 기본 정보 → 상세 → 옵션 → 가격·배송 → 일정 → (FAQ) → 심사 제출.
 * 단계마다 응답의 새 version을 다음 요청에 넘긴다. 이미지는 올릴 때 이미 서버에 연결되어 있다.
 */
export async function submitListing(d: Draft, id: string): Promise<Product> {
  let p = await getSellerProduct(id);
  const v = () => p.version ?? 0;
  p = await saveBasicInfo(id, v(), basicInfoOf(d));
  p = await saveDetails(id, v(), detailsOf(d));
  const o = optionPayload(d);
  if (!o.variants.length) throw new Error('옵션별 한정 수량을 입력해 주세요.');
  p = await saveOptions(id, v(), o);
  p = await savePricingShipping(id, v(), { price: d.price, shippingFee: d.shipping, dispatchBusinessDays: d.dispatchDays, perAccountLimit: d.maxPerAccount });
  p = await saveSchedule(id, v(), startIso(d));
  if (d.faqs.length) p = await saveRegistrationFaqs(id, v(), d.faqs.filter(f => f.question.trim() && f.answer.trim()).map(f => ({ id: f.id.startsWith('faq-') ? undefined : f.id, question: f.question, answer: f.answer })));
  return submitReview(id, v());
}
/** 승인 상품 수정 제출(실제 모드): 가격·옵션·수량은 수정 대상이 아니다. 이미지는 draft.imageIds 순서, 대표=첫 장 */
export async function submitRevisionFromDraft(d: Draft, id: string): Promise<ProductRevisionDto> {
  const p = await getSellerProduct(id), ids = (d.imageIds ?? []).filter(Boolean);
  if (!ids.length) throw new Error('상품 사진을 확인해 주세요.');
  return submitRevision(id, p.version ?? 0, { name: d.name.trim(), description: d.description.trim(), imageIds: ids, representativeId: ids[0], shippingFee: d.shipping, dispatchBusinessDays: d.dispatchDays, startsAt: startIso(d) });
}
/** AI 점검(실제 모드): 현재 입력을 기본 정보로 저장 → 요청 → 폴링. 결과의 카테고리 코드는 점검 기준 이름으로 바꾼다 */
/**
 * 실제 모드 AI 분석을 시작할 수 있는지. 시작 조건은 이 함수 한 곳에서만 바꾼다. null = 시작 가능.
 * 지금은 사진 + 상품명이 있어야 한다. 백엔드 답변 후 사진만으로 분석하게 하려면 상품명 줄만 지운다.
 */
export function analysisBlocker(d: Pick<Draft, 'name' | 'images'>): string | null {
  if (!d.images.length) return '상품 사진을 먼저 올려 주세요.';
  if (!d.name.trim()) return '상품명을 먼저 입력하면 AI가 카테고리를 분석해요.';
  return null;
}
export async function analyzeDraft(d: Draft, id: string, o?: { interval?: number; tries?: number }) {
  const blocked = analysisBlocker(d); if (blocked) throw new Error(blocked);
  // 단계 이름을 붙여 던진다(서버가 violations 없이 PRODUCT_INVALID만 주는 경우 어느 단계인지 보이게)
  const at_ = async <T,>(stage: string, f: () => Promise<T>): Promise<T> => { try { return await f(); } catch (e) { throw new Error(`${stage}: ${errorMessage(e)}`); } };
  const meta = await at_('등록 정보 조회 실패', getRegistrationMetadata);
  // 매 단계의 응답 version을 다음 요청에 쓴다(낙관적 잠금)
  // 서버 값과 같으면 저장하지 않는다(재분석마다 version이 2씩 오르던 문제). 명세: AI 점검은 현재 이미지·기본정보·처분 사유 기준
  let p = await at_('상품 조회 실패', () => getSellerProduct(id));
  const basic = basicInfoOf(d, meta.categories), details = detailsOf(d);
  if (!sameBasic(basic, p)) p = await at_('기본 정보 저장 실패', () => saveBasicInfo(id, p.version ?? 0, basic));
  if (!sameDetails(details, p)) p = await at_('상세 정보 저장 실패', () => saveDetails(id, p.version ?? 0, details));
  const accepted = await at_('AI 분석 요청 실패', () => requestAiAnalysis(id, p.version ?? 0));
  const r = await at_('AI 분석 결과 확인 실패', () => pollAiAnalysis(accepted.requestId, o));
  // 추측(명세 없음): recommendedCategory(코드, 예 CLOTHING)의 이름(예 의류)을 등록 카테고리 이름으로 쓴다
  const category = r.recommendedCategory ? meta.categoryCriteria.find(c => c.code === r.recommendedCategory)?.name ?? r.recommendedCategory : '';
  return { outcome: r.outcome, category, questions: r.questions ?? [], categories: meta.categories };
}
