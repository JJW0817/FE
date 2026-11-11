/**
 * 상품(공개 조회) 도메인 — API 함수 + 서버 응답 → 화면 타입 변환. 화면은 여기서 돌려준 Product만 쓴다.
 * 명세: docs/api-spec.md 3절. 모두 일반 Gateway(`general`), 비로그인 조회 가능.
 *
 * 패턴(다른 도메인도 동일):
 *  1. `xxxFromApi(dto)` 변환 함수 — 응답 해석은 여기서만
 *  2. `getXxx()/listXxx()` API 함수 — `api.get(..., { service })` 후 변환해서 반환
 *  3. `mergeXxx(state, items)` — 화면이 읽는 store에 반영 (useLive의 apply로 사용)
 *  4. 명세에 없는 기능은 mock 유지 + `TODO(api-gap)` 주석
 */
import type { Product, State } from '../domain';
import { api } from './client';
import { ms } from './mappers';
import type { ItemsPage, ProductDetailDto, ProductFaqDto, ProductOptionDto, ProductSummaryDto, SaleStatus, ScheduleDto } from './types';

const service = 'general' as const;

/* ── 변환 ── */
/** 목록 요약 → Product. 옵션·설명은 목록에 없어 비워 두고 재고는 요약(live)으로 */
export function productSummaryFromApi(d: ProductSummaryDto): Product {
  return {
    id: d.id, sellerId: '', name: d.name, brand: d.brandOrStore, category: d.category, description: '', images: d.image?.url ? [d.image.url] : [], originalUrl: '',
    price: d.price, shipping: 0, maxPerAccount: 0, dispatchDays: 0, startsAt: Date.parse(d.startsAt), endsAt: Date.parse(d.endsAt), published: true,
    options: [], dimensions: [], extras: [], reason: '', faqs: [], soldOutAt: ms(d.soldOutAt),
    live: { initial: d.stock.initialQuantity, available: d.stock.availableQuantity },
  };
}
/** 상세 → Product. 옵션 stock은 서버의 남은 수량(availableQuantity) */
export function productFromApi(d: ProductDetailDto): Product {
  const images = [...d.images].sort((a, b) => a.position - b.position).map(i => i.url).filter((u): u is string => !!u);
  return {
    id: d.id, sellerId: d.sellerId, name: d.name, brand: d.brandOrStore, category: d.category, description: d.description, images, originalUrl: d.sourceUrl,
    price: d.price, shipping: d.shippingFee, maxPerAccount: d.perAccountLimit, dispatchDays: d.dispatchBusinessDays,
    startsAt: Date.parse(d.startsAt), endsAt: Date.parse(d.endsAt), published: true,
    options: d.options.map(optionFromApi),
    dimensions: d.dimensions.map(x => ({ name: x.name, values: x.values.join(', ') })),
    extras: d.attributes.map(a => ({ key: a.name, value: a.value })),
    reason: d.disposalReason ?? '',
    faqs: d.faqs.map(faqFromApi),
    soldOutAt: ms(d.soldOutAt),
    live: { initial: d.stock.initialQuantity, available: d.stock.availableQuantity },
  };
}
export const optionFromApi = (o: ProductOptionDto) => ({ id: o.id, name: o.label, stock: o.availableQuantity });
export const faqFromApi = (f: ProductFaqDto) => ({ id: f.id, question: f.question, answer: f.answer, confirmed: true });
/** 화면 필터 '판매 중' 등 → 서버 status */
export const SALE_STATUS: Record<string, SaleStatus> = { '판매 예정': 'UPCOMING', '판매 중': 'ON_SALE', '판매 종료': 'ENDED' };

/* ── API ── */
export interface ProductQuery { keyword?: string; category?: string; status?: SaleStatus; sort?: 'NEWEST' | 'ENDING_SOON' | 'PRICE_ASC' | 'PRICE_DESC'; page?: number; size?: number; startsFrom?: number; startsTo?: number }
export interface ProductPage { items: Product[]; page: number; totalPages: number; totalElements: number; serverTime?: number }
const iso = (t?: number) => (t === undefined ? undefined : new Date(t).toISOString());

/** GET /v1/products — 홈·검색·일정 목록 */
export async function listProducts(q: ProductQuery = {}, signal?: AbortSignal): Promise<ProductPage> {
  const r = await api.get<ItemsPage<ProductSummaryDto> & { serverTime?: string }>('/v1/products', { service, signal, query: { ...q, startsFrom: iso(q.startsFrom), startsTo: iso(q.startsTo) } });
  return { items: r.items.map(productSummaryFromApi), page: r.page, totalPages: r.totalPages, totalElements: r.totalElements, serverTime: ms(r.serverTime) };
}
/** GET /v1/products/{id} — 상세(옵션·이미지·FAQ 포함) */
export async function getProduct(id: string, signal?: AbortSignal): Promise<Product> {
  return productFromApi(await api.get<ProductDetailDto>(`/v1/products/${encodeURIComponent(id)}`, { service, signal }));
}
/** GET /v1/products/{id}/options — 옵션별 남은 수량만 다시 볼 때 */
export async function getProductOptions(id: string, signal?: AbortSignal) {
  return (await api.get<ProductOptionDto[]>(`/v1/products/${encodeURIComponent(id)}/options`, { service, signal })).map(optionFromApi);
}
/** GET /v1/products/{id}/faqs */
export async function getProductFaqs(id: string, signal?: AbortSignal) {
  return (await api.get<ProductFaqDto[]>(`/v1/products/${encodeURIComponent(id)}/faqs`, { service, signal })).map(faqFromApi);
}
/** GET /v1/products/schedule — 날짜별 판매 개수 (KST, 최대 다음 주 일요일). 키: yyyy-MM-dd */
export async function getSchedule(range: { from?: string; to?: string } = {}, signal?: AbortSignal): Promise<Record<string, { count: number; firstStartsAt: number }>> {
  const r = await api.get<ScheduleDto>('/v1/products/schedule', { service, signal, query: range });
  return Object.fromEntries(r.days.map(d => [d.date, { count: d.productCount, firstStartsAt: Date.parse(d.firstStartsAt) }]));
}
/** GET /v1/categories — 구매자 필터용 카테고리 이름 */
export async function listCategories(signal?: AbortSignal): Promise<string[]> {
  return (await api.get<{ categories: string[] }>('/v1/categories', { service, signal })).categories;
}

/* ── store 반영 ── */
/** 받은 상품을 store에 넣는다. 목록 요약이 상세(옵션·설명)를 지우지 않게 빈 값은 기존 값을 유지한다 */
export function mergeProducts(s: State, items: Product[]) {
  for (const p of items) {
    const i = s.products.findIndex(x => x.id === p.id);
    if (i < 0) { s.products.push(p); continue; }
    const old = s.products[i];
    s.products[i] = { ...old, ...p, options: p.options.length ? p.options : old.options, description: p.description || old.description, images: p.images.length ? p.images : old.images,
      sellerId: p.sellerId || old.sellerId, originalUrl: p.originalUrl || old.originalUrl, shipping: p.shipping || old.shipping, maxPerAccount: p.maxPerAccount || old.maxPerAccount, dispatchDays: p.dispatchDays || old.dispatchDays,
      dimensions: p.dimensions.length ? p.dimensions : old.dimensions, extras: p.extras.length ? p.extras : old.extras, reason: p.reason || old.reason, faqs: p.faqs.length ? p.faqs : old.faqs };
  }
}
