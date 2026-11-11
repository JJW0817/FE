/**
 * 문의 도메인(구매자) — 명세 docs/api-spec.md 3절(상품 문의)·4절(주문 문의·문의 이미지).
 * 조회=일반 Gateway(`general`), 쓰기·이미지 권한/완료/열람=PurchaseGateway(`purchase`).
 * 화면은 상품·주문·운영 문의를 한 `Inquiry` 타입으로 보므로 여기서 변환해 store에 넣는다.
 * 운영(고객센터) 1:1 문의는 API가 없어 화면의 로컬 동작을 유지한다 (TODO(api-gap), 화면 쪽).
 */
import type { Inquiry, State } from '../domain';
import { api } from './client';
import type { ImageUploadDto, InquiryCardDto, OrderInquiryDto, ProductInquiryDto } from './types';

const general = 'general' as const, purchase = 'purchase' as const;
const enc = encodeURIComponent;
const base = (orderId: string) => `/v1/orders/${enc(orderId)}`;

/* ── 변환 ── */
/** 주문 문의 상세·목록 항목 → Inquiry. 상품명·판매자·수량은 응답에 없어 merge가 주문에서 채운다 */
export function orderInquiryFromApi(d: OrderInquiryDto, userId: string): Inquiry {
  const msgs = d.messages.map(m => ({ seller: m.seller, body: m.body, createdAt: Date.parse(m.createdAt) }));
  return {
    id: d.id, userId, sellerId: '', productId: '', orderId: d.orderId, productName: '', kind: d.category,
    question: msgs.find(m => !m.seller)?.body ?? '', answer: [...msgs].reverse().find(m => m.seller)?.body,
    public: false, createdAt: d.createdAt ? Date.parse(d.createdAt) : (msgs[0]?.createdAt ?? 0), messages: msgs, imageIds: d.imageIds,
  };
}
/** 문의함 항목 → Inquiry. 추측(명세 없음): 카드에는 마지막 메시지만 있어 question=lastMessage, 판매자 차례가 아니면(awaitingSeller=false) 답변 있음으로 본다 */
export function inquiryFromCard(d: InquiryCardDto, userId: string): Inquiry {
  return {
    id: d.id, userId, sellerId: '', productId: d.productId, orderId: d.orderId, productName: d.productName, kind: d.category,
    question: d.lastMessage, answer: d.awaitingSeller ? undefined : d.lastMessage, public: false, createdAt: Date.parse(d.createdAt),
  };
}
/** 상품 문의(구매 전) → Inquiry. 상품명은 merge가 상품에서 채운다 */
export function productInquiryFromApi(d: ProductInquiryDto, productId: string, userId: string): Inquiry {
  return { id: d.id, userId, sellerId: '', productId, productName: '', kind: '상품 문의', question: d.question, answer: d.answer ?? undefined, public: false, createdAt: Date.parse(d.createdAt) };
}

/* ── API: 상품 문의 ── */
/** GET /v1/products/{id}/inquiries — 본인 상품 문의와 답변. 목록은 `items` */
export async function listProductInquiries(productId: string, userId: string, signal?: AbortSignal): Promise<Inquiry[]> {
  const r = await api.get<{ items: ProductInquiryDto[] }>(`/v1/products/${enc(productId)}/inquiries`, { service: general, signal, query: { size: 100 } });
  return r.items.map(d => productInquiryFromApi(d, productId, userId));
}
/** POST /v1/products/{productId}/inquiries — 상품 문의 등록 (201) */
export async function createProductInquiry(productId: string, question: string, userId: string): Promise<Inquiry> {
  return productInquiryFromApi(await api.post<ProductInquiryDto>(`/v1/products/${enc(productId)}/inquiries`, { question }, { service: purchase }), productId, userId);
}

/* ── API: 주문 문의 ── */
/** GET /v1/orders/inquiries — 구매자 전체 문의함 (최신순). 목록은 `content` */
export async function listInquiryInbox(userId: string, signal?: AbortSignal): Promise<Inquiry[]> {
  const r = await api.get<{ content: InquiryCardDto[] }>('/v1/orders/inquiries', { service: general, signal, query: { size: 100 } });
  return r.content.map(d => inquiryFromCard(d, userId));
}
/** GET /v1/orders/{id}/inquiries — 한 주문의 문의 목록 */
export async function listOrderInquiries(orderId: string, userId: string, signal?: AbortSignal): Promise<Inquiry[]> {
  const r = await api.get<{ content: OrderInquiryDto[] }>(`${base(orderId)}/inquiries`, { service: general, signal, query: { size: 100 } });
  return r.content.map(d => orderInquiryFromApi(d, userId));
}
/** GET /v1/orders/{id}/inquiries/{inquiryId} — 문의 상세(메시지 전체·imageIds) */
export async function getOrderInquiry(orderId: string, inquiryId: string, userId: string, signal?: AbortSignal): Promise<Inquiry> {
  return orderInquiryFromApi(await api.get<OrderInquiryDto>(`${base(orderId)}/inquiries/${enc(inquiryId)}`, { service: general, signal }), userId);
}
/** POST /v1/orders/{order}/inquiries — 문의 등록 (CONFIRMED 주문만). requestKey가 같으면 같은 문의 */
export async function createOrderInquiry(orderId: string, b: { category: string; body: string; imageIds: string[]; requestKey?: string }, userId: string): Promise<Inquiry> {
  return orderInquiryFromApi(await api.post<OrderInquiryDto>(`${base(orderId)}/inquiries`, { requestKey: crypto.randomUUID(), ...b }, { service: purchase }), userId);
}
/** GET /v1/orders/{order}/inquiries/{id}/editing — 작성용 원본(version 포함) */
export const getInquiryEditing = (orderId: string, inquiryId: string, signal?: AbortSignal) =>
  api.get<OrderInquiryDto & { version: number }>(`${base(orderId)}/inquiries/${enc(inquiryId)}/editing`, { service: purchase, signal });
/** POST /v1/orders/{order}/inquiries/{id}/messages — 추가 메시지. 응답은 문의 전체 */
export async function addInquiryMessage(orderId: string, inquiryId: string, body: string, userId: string, requestKey = crypto.randomUUID()): Promise<Inquiry> {
  return orderInquiryFromApi(await api.post<OrderInquiryDto>(`${base(orderId)}/inquiries/${enc(inquiryId)}/messages`, { requestKey, body }, { service: purchase }), userId);
}

/* ── API: 문의 이미지 (권한 발급 → S3 PUT → 완료 확인) ── */
/** POST …/inquiry-images — 업로드 권한(5분 유효 PUT URL) 발급 */
export const requestInquiryImageUpload = (orderId: string, f: { contentType: string; sizeBytes: number }) =>
  api.post<ImageUploadDto>(`${base(orderId)}/inquiry-images`, f, { service: purchase });
/** POST …/inquiry-images/{id}/completion — S3 PUT 후 완료 확인(멱등) */
export const completeInquiryImage = (orderId: string, imageId: string) =>
  api.post<ImageUploadDto>(`${base(orderId)}/inquiry-images/${enc(imageId)}/completion`, undefined, { service: purchase });
/** DELETE …/inquiry-images/{id} — 문의에 연결 전 이미지 폐기 */
export const deleteInquiryImage = (orderId: string, imageId: string) =>
  api.delete<null>(`${base(orderId)}/inquiry-images/${enc(imageId)}`, { service: purchase });
/** GET …/inquiry-images/{id}/download — 5분 유효 열람 URL (만료되면 다시 발급) */
export async function getInquiryImageUrl(orderId: string, imageId: string, signal?: AbortSignal): Promise<string> {
  return (await api.get<ImageUploadDto>(`${base(orderId)}/inquiry-images/${enc(imageId)}/download`, { service: purchase, signal })).url ?? '';
}
/** 이미지 한 장 업로드 3단계 → imageId. S3 PUT은 Authorization 없이 정확한 Content-Type으로 보내므로 api 클라이언트가 아니라 fetch를 쓴다 */
export async function uploadInquiryImage(orderId: string, file: File, putFetch: typeof fetch = (u, i) => fetch(u, i)): Promise<string> {
  const g = await requestInquiryImageUpload(orderId, { contentType: file.type, sizeBytes: file.size });
  if (!g.url) throw new Error('업로드 주소를 받지 못했어요. 다시 시도해 주세요.');
  const r = await putFetch(g.url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
  if (!r.ok) { await deleteInquiryImage(orderId, g.id).catch(() => {}); throw new Error('사진을 올리지 못했어요. 다시 시도해 주세요.'); }
  await completeInquiryImage(orderId, g.id);
  return g.id;
}

/* ── store 반영 ── */
/** 상품명·판매자·수량을 주문/상품에서 채운다 (응답에 없는 값) */
function fill(s: State, n: Inquiry): Inquiry {
  const o = s.orders.find(x => x.id === n.orderId), p = s.products.find(x => x.id === (n.productId || o?.productId));
  return {
    ...n, sellerId: n.sellerId || o?.sellerId || p?.sellerId || '', productId: n.productId || o?.productId || '',
    productName: n.productName || (o ? `${o.product.brand} · ${o.product.name}` : p?.name ?? ''), quantity: n.quantity ?? o?.lines.reduce((a, l) => a + l.quantity, 0),
  };
}
/** 문의를 id로 upsert. 상세로 받은 메시지·이미지·상품명은 요약(카드)이 지우지 않게 유지 */
export function mergeInquiries(s: State, items: Inquiry[]) {
  for (const raw of items) {
    const n = fill(s, raw), i = s.inquiries.findIndex(x => x.id === n.id);
    if (i < 0) { s.inquiries.unshift(n); continue; }
    const old = s.inquiries[i];
    s.inquiries[i] = { ...old, ...n, productName: n.productName || old.productName, sellerId: n.sellerId || old.sellerId, quantity: n.quantity ?? old.quantity, messages: n.messages ?? old.messages, imageIds: n.imageIds ?? old.imageIds };
  }
}
