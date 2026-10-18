export type Category = '의류' | '패션잡화' | '문구' | '생활잡화';
export const CATEGORIES: Category[] = ['의류', '패션잡화', '문구', '생활잡화'];
export const CATEGORY_PATHS = ['의류 / 상의 / 티셔츠', '의류 / 상의 / 가디건', '의류 / 하의', '패션잡화 / 가방', '패션잡화 / 모자', '패션잡화 / 소품', '문구 / 노트', '문구 / 필기구', '문구 / 사무용품', '생활잡화 / 수납용품', '생활잡화 / 생활소품'];
export interface Extra { key: string; value: string }
export interface Faq { id: string; question: string; answer: string; confirmed: boolean }
export interface Option { id: string; name: string; stock: number }
export interface Dimension { name: string; values: string }
export interface Product {
  id: string; sellerId: string; name: string; brand: string; category: string; description: string;
  images: string[]; originalUrl: string; price: number; shipping: number; maxPerAccount: number;
  dispatchDays: number; startsAt: number; endsAt: number; published: boolean; options: Option[];
  dimensions: Dimension[]; extras: Extra[]; reason: string; faqs: Faq[];
}
export interface User { id: string; name: string; email: string; phone: string; seller: boolean; admin: boolean }
export interface AuthData {
  onboarded: boolean; userId: string | null;
  credentials: Record<string, { salt: string; hash: string }>;
  challenges: Record<string, { email: string; code: string; purpose: 'signup' | 'reset'; expiresAt: number; sentAt: number; attempts: number; verified: boolean }>;
  loginFailures: Record<string, { count: number; until: number }>;
  consents: Record<string, { acceptedAt: number; marketing: boolean }>;
}
export const initialAuth = (): AuthData => ({ onboarded: false, userId: null, credentials: {}, challenges: {}, loginFailures: {}, consents: {} });
export interface Address { name: string; phone: string; address: string; detail: string; request: string }
export interface DocumentFile { id: string; name: string; size: number; uploadedAt: number }
export interface Application {
  id: string; userId: string; displayName: string; name: string; email: string; phone: string;
  document: DocumentFile; bank: string; account: string; shippingAddress: string; returnAddress: string;
  status: 'pending' | 'approved'; submittedAt: number; approvedAt?: number; approvedBy?: string;
}
export interface Line { optionId: string; name: string; quantity: number }
export interface Hold { id: string; userId: string; productId: string; lines: Line[]; createdAt: number; expiresAt: number; status: 'reserved' | 'pending' | 'consumed' | 'released'; orderId?: string }
export type OrderStatus = 'paid' | 'preparing' | 'shipping' | 'delivered' | 'cancelled' | 'refunded';
export interface Order {
  id: string; userId: string; sellerId: string; productId: string; holdId: string; lines: Line[];
  product: { name: string; brand: string; image: string; category: string; originalUrl: string; price: number };
  shipping: number; total: number; address: Address; status: OrderStatus; createdAt: number;
  carrier?: string; tracking?: string; shippedAt?: number; deliveredAt?: number; deliveredPlace?: string;
  deliveredMemo?: string; processedBy?: string; processedAt?: number;
}
export interface Inquiry { id: string; userId: string; sellerId: string; productId: string; orderId?: string; productName: string; kind: string; question: string; answer?: string; public: boolean; createdAt: number }
export type AiStatus = 'before' | 'analyzing' | 'recommended' | 'uncertain' | 'failed' | 'unsupported' | 'stale';
export interface Draft {
  editingId?: string; step: number; name: string; brand: string; description: string; images: string[];
  category: string; originalUrl: string; extras: Extra[]; reason: string; dimensions: Dimension[];
  noOptions: boolean; options: Option[]; price: number; shipping: number; dispatchDays: number;
  maxPerAccount: number; startsAt: string; faqs: Faq[];
  ai: { status: AiStatus; signature: string; category: string; reason: string };
}
export interface SellerSettings { displayName: string; bank: string; account: string; holder: string; shippingAddress: string; returnAddress: string; notifications: Record<string, boolean> }
export interface State {
  version: 1; auth?: AuthData; activeUserId: string; mode: 'buyer' | 'seller' | 'admin'; users: User[]; products: Product[];
  applications: Application[]; holds: Hold[]; orders: Order[]; inquiries: Inquiry[]; drafts: Record<string, Draft>;
  addresses: Record<string, Address>; sellerSettings: Record<string, SellerSettings>; bookmarks: string[];
  clockOffset: number; paymentOutcome: 'success' | 'failure' | 'pending'; aiOutcome: 'auto' | 'uncertain' | 'failed' | 'unsupported';
}
export class DomainError extends Error { constructor(message: string, public code = 'invalid') { super(message); } }
export const money = (n: number) => `${n.toLocaleString('ko-KR')}원`;
export const uid = (prefix = '') => `${prefix}${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
export const localDateTime = (n: number) => { const d = new Date(n); return new Date(n - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); };
export const nowOf = (s: State) => Date.now() + s.clockOffset;
export const activeUser = (s: State) => s.users.find(u => u.id === s.activeUserId)!;
export const defaultAddress: Address = { name: '김서윤', phone: '010-1234-5678', address: '서울시 성동구 연무장길 00', detail: '501호', request: '문 앞에 놓아 주세요.' };
export function blankDraft(now = Date.now()): Draft {
  return { step: 1, name: '', brand: '', description: '', images: [], category: '', originalUrl: '', extras: [{ key: '', value: '' }], reason: '', dimensions: [{ name: '색상', values: '' }], noOptions: false, options: [], price: 0, shipping: 3000, dispatchDays: 2, maxPerAccount: 2, startsAt: localDateTime(now + 3_600_000), faqs: [], ai: { status: 'before', signature: '', category: '', reason: '' } };
}
export function inputSignature(d: Pick<Draft, 'name' | 'description' | 'images'>) { return JSON.stringify([d.name.trim(), d.description.trim(), d.images]); }
export function unsupportedInput(name: string, description: string): boolean {
  const value = `${name} ${description}`.toLowerCase().replace(/화장품\s*(파우치|가방)/g, '파우치');
  return /건강기능식품|비타민|영양제|식품|간식|음료|화장품|스킨케어|립스틱|전기제품|전기포트|충전기|무선이어폰|중고품|전시품|하자\s*상품/.test(value);
}
export function recommendCategory(d: Draft): { status: AiStatus; category: string; reason: string; signature: string } {
  const signature = inputSignature(d);
  if (unsupportedInput(d.name, d.description)) return { status: 'unsupported', category: '', reason: '지원하는 상품군의 미판매 새 상품만 등록할 수 있습니다.', signature };
  const text = `${d.name} ${d.description}`;
  const matches: [RegExp, string, string][] = [[/노트|공책/, '문구 / 노트', '상품명과 설명의 노트·구성 정보를 참고했어요.'], [/에코백|가방|파우치/, '패션잡화 / 가방', '상품명과 설명의 가방 정보를 참고했어요.'], [/바구니|수납/, '생활잡화 / 수납용품', '수납 용도와 규격 정보를 참고했어요.'], [/가디건/, '의류 / 상의 / 가디건', '상품명과 설명의 가디건 정보를 참고했어요.'], [/티셔츠|반팔/, '의류 / 상의 / 티셔츠', '상품명과 설명의 상의 정보를 참고했어요.']];
  const match = matches.find(([re]) => re.test(text));
  return match ? { status: 'recommended', category: match[1], reason: match[2], signature } : { status: 'uncertain', category: '', reason: '판단하기 어려워요. 상품 설명을 보완하거나 지원 목록에서 직접 선택해 주세요.', signature };
}
export function combinations(dimensions: Dimension[], previous: Option[] = []): Option[] {
  const dims = dimensions.filter(d => d.name.trim() && d.values.trim());
  if (!dims.length) throw new DomainError('옵션명과 옵션값을 입력해 주세요.');
  let names = [''];
  for (const d of dims) {
    const values = [...new Set(d.values.split(',').map(v => v.trim()).filter(Boolean))];
    names = names.flatMap(n => values.map(v => n ? `${n} / ${v}` : v));
    if (names.length > 40) throw new DomainError('옵션 조합은 최대 40개까지 만들 수 있습니다.');
  }
  return names.map(name => { const old = previous.find(o => o.name === name); return { id: old?.id ?? uid('opt-'), name, stock: old?.stock ?? 0 }; });
}
export function saleState(p: Product, now: number): '판매 예정' | '판매 중' | '판매 종료' | '게시 전' {
  if (!p.published) return '게시 전';
  if (now < p.startsAt) return '판매 예정';
  return now >= p.endsAt ? '판매 종료' : '판매 중';
}
export function available(s: State, p: Product, optionId: string, now: number): number {
  const initial = p.options.find(o => o.id === optionId)?.stock ?? 0;
  const sold = s.orders.filter(o => o.productId === p.id && !['cancelled', 'refunded'].includes(o.status)).reduce((sum, o) => sum + o.lines.filter(l => l.optionId === optionId).reduce((a, l) => a + l.quantity, 0), 0);
  const held = s.holds.filter(h => h.productId === p.id && (h.status === 'pending' || h.status === 'reserved' && h.expiresAt > now)).reduce((sum, h) => sum + h.lines.filter(l => l.optionId === optionId).reduce((a, l) => a + l.quantity, 0), 0);
  return Math.max(0, initial - sold - held);
}
export function expireHolds(s: State, now: number): boolean {
  let changed = false;
  for (const h of s.holds) if (h.status === 'reserved' && h.expiresAt <= now) { h.status = 'released'; changed = true; }
  return changed;
}
export function reserve(s: State, userId: string, productId: string, quantities: Record<string, number>, now: number): Hold {
  if (!s.users.some(u => u.id === userId)) throw new DomainError('로그인이 필요합니다.');
  const p = s.products.find(p => p.id === productId);
  if (!p || saleState(p, now) !== '판매 중') throw new DomainError('판매 시간에만 구매할 수 있습니다.', 'sale-closed');
  expireHolds(s, now);
  const existing = s.holds.find(h => h.userId === userId && h.productId === p.id && (h.status === 'pending' || h.status === 'reserved' && h.expiresAt > now));
  if (existing) throw new DomainError(`진행 중인 주문이 있습니다.`, `existing:${existing.id}`);
  const pairs = Object.entries(quantities).filter(([, quantity]) => quantity > 0);
  if (!pairs.length) throw new DomainError('옵션과 수량을 선택해 주세요.');
  const lines = pairs.map(([id, quantity]) => { const option = p.options.find(o => o.id === id); if (!option || !Number.isInteger(quantity) || quantity < 1) throw new DomainError('올바른 옵션과 수량을 선택해 주세요.'); return { optionId: id, name: option.name, quantity }; });
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const already = s.orders.filter(o => o.userId === userId && o.productId === p.id && !['cancelled', 'refunded'].includes(o.status)).reduce((n, o) => n + o.lines.reduce((a, l) => a + l.quantity, 0), 0);
  if (count + already > p.maxPerAccount) throw new DomainError(`계정당 최대 ${p.maxPerAccount}개까지 구매할 수 있습니다.`, 'limit');
  for (const l of lines) if (available(s, p, l.optionId, now) < l.quantity) throw new DomainError(`${l.name} 재고가 부족합니다. 다른 옵션도 확보되지 않았습니다.`, 'stock');
  const hold: Hold = { id: uid('hold-'), userId, productId, lines, createdAt: now, expiresAt: now + 300_000, status: 'reserved' };
  s.holds.push(hold); return hold;
}
export function beginPayment(s: State, userId: string, holdId: string, now: number) {
  const hold = s.holds.find(h => h.id === holdId && h.userId === userId);
  if (!hold) throw new DomainError('주문을 찾을 수 없습니다.');
  if (hold.status === 'consumed') return hold;
  if (hold.status !== 'pending' && (hold.status !== 'reserved' || hold.expiresAt <= now)) { hold.status = 'released'; throw new DomainError('확보 시간이 만료되었습니다.', 'expired'); }
  hold.status = 'pending'; return hold;
}
export function resolvePayment(s: State, userId: string, holdId: string, outcome: 'success' | 'failure' | 'pending', address: Address, now: number): Order | undefined {
  const hold = s.holds.find(h => h.id === holdId && h.userId === userId);
  if (!hold) throw new DomainError('주문을 찾을 수 없습니다.');
  if (hold.orderId) return s.orders.find(o => o.id === hold.orderId);
  if (hold.status !== 'pending') throw new DomainError('결제 진행 상태를 확인해 주세요.');
  if (outcome === 'pending') return undefined;
  if (outcome === 'failure') { hold.status = now < hold.expiresAt ? 'reserved' : 'released'; return undefined; }
  const p = s.products.find(p => p.id === hold.productId)!;
  const subtotal = hold.lines.reduce((sum, l) => sum + l.quantity * p.price, 0);
  const order: Order = { id: uid('SD-'), holdId: hold.id, userId, sellerId: p.sellerId, productId: p.id, lines: structuredClone(hold.lines), product: { name: p.name, brand: p.brand, image: p.images[0], category: p.category, originalUrl: p.originalUrl, price: p.price }, shipping: p.shipping, total: subtotal + p.shipping, address: { ...address }, status: 'paid', createdAt: now };
  s.orders.unshift(order); hold.status = 'consumed'; hold.orderId = order.id; return order;
}
export function approveApplication(s: State, actorId: string, requestId: string, now: number) {
  if (!s.users.find(u => u.id === actorId)?.admin) throw new DomainError('운영자만 승인할 수 있습니다.', 'forbidden');
  const app = s.applications.find(a => a.id === requestId);
  if (!app || app.status !== 'pending') throw new DomainError('이미 승인되었거나 존재하지 않는 신청입니다.');
  if (!app.document.id) throw new DomainError('사업자등록증을 확인해 주세요.');
  const user = s.users.find(u => u.id === app.userId)!;
  app.status = 'approved'; app.approvedAt = now; app.approvedBy = actorId; user.seller = true;
  s.sellerSettings[user.id] = { displayName: app.displayName || `${user.name}의 스토어`, bank: app.bank, account: app.account, holder: app.name, shippingAddress: app.shippingAddress, returnAddress: app.returnAddress, notifications: { 신규주문: true, 문의: true, 판매일정: true, 마케팅: false } };
}
export function markDelivered(s: State, sellerId: string, orderId: string, deliveredAt: number, place: string, memo: string, checked: boolean, now: number) {
  const o = s.orders.find(o => o.id === orderId && o.sellerId === sellerId);
  if (!s.users.find(u => u.id === sellerId)?.seller || !o) throw new DomainError('판매자 주문을 찾을 수 없습니다.', 'forbidden');
  if (o.status !== 'shipping' || !o.tracking) throw new DomainError('운송장이 등록된 배송 중 주문만 처리할 수 있습니다.');
  if (!checked || !place.trim() || !Number.isFinite(deliveredAt)) throw new DomainError('배송완료 일시·수령 장소·확인 항목을 입력해 주세요.');
  if (deliveredAt > now || deliveredAt < Math.floor((o.shippedAt ?? o.createdAt) / 60_000) * 60_000) throw new DomainError('출고 이후부터 현재까지의 일시를 선택해 주세요.');
  o.status = 'delivered'; o.deliveredAt = deliveredAt; o.deliveredPlace = place.trim(); o.deliveredMemo = memo.trim(); o.processedBy = sellerId; o.processedAt = now;
}
export function feeFor(s: State, p: Product) {
  const initial = p.options.reduce((n, o) => n + o.stock, 0);
  const orders = s.orders.filter(o => o.productId === p.id && !['cancelled', 'refunded'].includes(o.status));
  const sold = orders.reduce((n, o) => n + o.lines.reduce((a, l) => a + l.quantity, 0), 0);
  const revenue = orders.reduce((n, o) => n + o.total - o.shipping, 0);
  const fee = initial > 0 && sold * 10 > initial * 9 ? Math.round(revenue * .1) : 0;
  return { initial, sold, revenue, rate: initial ? sold / initial : 0, fee, net: revenue - fee };
}
export function validateDraft(d: Draft, step: number, now: number) {
  if (unsupportedInput(d.name, d.description) || d.ai.status === 'unsupported') throw new DomainError('지원하지 않는 상품은 등록할 수 없습니다.');
  if (step >= 1) {
    if (!d.images.length || !d.name.trim() || !d.description.trim()) throw new DomainError('상품 이미지·상품명·설명을 입력해 주세요.');
    if (!CATEGORY_PATHS.includes(d.category)) throw new DomainError('최종 카테고리를 저장해 주세요.');
    try { const url = new URL(d.originalUrl); if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.')) throw new Error(); } catch { throw new DomainError('기존 판매 상품 URL을 올바르게 입력해 주세요.'); }
  }
  if (step >= 2 && !d.reason.trim()) throw new DomainError('재고 처분 사유를 입력해 주세요.');
  if (step >= 3 && (!d.options.length || d.options.some(o => !o.name.trim() || !Number.isInteger(o.stock) || o.stock < 0) || !d.options.some(o => o.stock > 0))) throw new DomainError('옵션과 최초 판매 수량을 확인해 주세요.');
  if (step >= 3 && !d.noOptions) {
    const expected = combinations(d.dimensions, d.options).map(o => o.name).sort().join('|');
    if (expected !== d.options.map(o => o.name).sort().join('|')) throw new DomainError('옵션명을 변경한 뒤 옵션 조합을 다시 만들어 주세요.');
  }
  if (step >= 4 && (!Number.isInteger(d.price) || d.price <= 0 || !Number.isInteger(d.shipping) || d.shipping < 0 || !Number.isInteger(d.maxPerAccount) || d.maxPerAccount < 1 || !Number.isInteger(d.dispatchDays) || d.dispatchDays < 1)) throw new DomainError('가격·배송비·출고 기간·구매 상한을 확인해 주세요.');
  const start = new Date(d.startsAt).getTime();
  if (step >= 5 && (!Number.isFinite(start) || start + 10_800_000 <= now)) throw new DomainError('판매 종료가 현재보다 이후가 되도록 일정을 설정해 주세요.');
  if (step >= 5 && start > now + 7 * 86_400_000) throw new DomainError('판매 시작은 현재부터 최대 7일 이내로 설정해 주세요.');
  if (step >= 6 && (!d.faqs.length || d.faqs.some(f => !f.answer.trim() || !f.confirmed))) throw new DomainError('공개할 예상 질문의 답변을 모두 확인해 주세요.');
}
export function publishDraft(s: State, userId: string, d: Draft, now: number): Product {
  if (!s.users.find(u => u.id === userId)?.seller) throw new DomainError('승인된 판매자만 게시할 수 있습니다.', 'forbidden');
  validateDraft(d, 7, now);
  const existing = d.editingId ? s.products.find(p => p.id === d.editingId && p.sellerId === userId) : undefined;
  if (d.editingId && (!existing || now >= existing.startsAt)) throw new DomainError('판매 시작 후에는 핵심 상품 정보를 변경할 수 없습니다.');
  const p: Product = { id: existing?.id ?? uid('product-'), sellerId: userId, name: d.name.trim(), brand: d.brand.trim() || s.sellerSettings[userId]?.displayName || '나의 스토어', category: d.category, description: d.description.trim(), images: [...d.images], originalUrl: d.originalUrl.trim(), price: d.price, shipping: d.shipping, maxPerAccount: d.maxPerAccount, dispatchDays: d.dispatchDays, startsAt: new Date(d.startsAt).getTime(), endsAt: new Date(d.startsAt).getTime() + 10_800_000, published: true, options: structuredClone(d.options), dimensions: structuredClone(d.dimensions), extras: d.extras.filter(e => e.key.trim() && e.value.trim()).map(e => ({ ...e })), reason: d.reason.trim(), faqs: structuredClone(d.faqs) };
  if (existing) s.products[s.products.indexOf(existing)] = p; else s.products.unshift(p);
  delete s.drafts[userId]; return p;
}
export function generateFaqs(d: Draft): Faq[] {
  const value = (re: RegExp) => d.extras.find(e => re.test(e.key))?.value ?? '';
  const questions = d.category.startsWith('문구') ? [['한 권당 몇 페이지인가요?', value(/페이지/)], ['한 옵션은 몇 개 구성인가요?', value(/구성/)], ['규격과 재질은 무엇인가요?', [value(/규격|크기/), value(/소재|재질/)].filter(Boolean).join(' · ')]] : d.category.startsWith('생활잡화') ? [['표시된 크기는 외부 치수인가요?', ''], ['무엇으로 만들었나요?', value(/소재|재질/)], ['사용 시 주의사항이 있나요?', value(/주의|사용|관리/)]] : d.category.startsWith('패션잡화') ? [['지퍼로 입구를 닫을 수 있나요?', ''], ['구성품은 무엇인가요?', value(/구성/)], ['어떻게 관리하나요?', value(/관리|사용/)]] : [['실측은 단면 기준인가요?', ''], ['안감과 비침은 어떤가요?', value(/특징|안감/)], ['어떻게 세탁하나요?', value(/관리|세탁/)]];
  return questions.map(([question, answer]) => ({ id: uid('faq-'), question, answer, confirmed: false }));
}
export function seedState(now = Date.now()): State {
  const base = { sellerId: 'seller', shipping: 3000, maxPerAccount: 2, dispatchDays: 2, published: true, reason: '시즌 종료 후 남은 미판매 새 상품', startsAt: now - 2_400_000, endsAt: now + 8_400_000 };
  const faq = (question: string, answer: string): Faq => ({ id: uid('faq-'), question, answer, confirmed: true });
  const products: Product[] = [
    { ...base, id: 'cardigan', name: '소프트 코튼 가디건', brand: 'OUI STUDIO', category: '의류 / 상의 / 가디건', price: 42000, images: ['./images/generated.png'], description: '부드러운 코튼 소재의 데일리 가디건입니다. 크림·네이비 두 가지 색상으로 준비했어요.', originalUrl: 'https://oui-studio.example/products/cardigan-01', dimensions: [{ name: '색상', values: '크림, 네이비' }, { name: '사이즈', values: 'S, M, L' }], options: [{ id: 'cs', name: '크림 / S', stock: 6 }, { id: 'cm', name: '크림 / M', stock: 8 }, { id: 'nm', name: '네이비 / M', stock: 7 }, { id: 'nl', name: '네이비 / L', stock: 9 }], extras: [{ key: '소재', value: '면 100%' }, { key: '크기·규격', value: 'S 총장52·가슴46cm / M 총장54·가슴48cm' }, { key: '관리·사용 안내', value: '찬물 단독 손세탁 권장' }, { key: '기타 특징', value: '안감 없음 · 크림 약간 비침 · 약간의 신축성' }], faqs: [faq('실측은 단면 기준인가요?', '네, 단면 기준입니다. S 총장 52cm / M 총장 54cm입니다.'), faq('비침이 있나요?', '크림 색상은 약간 비칠 수 있습니다.'), faq('세탁기 사용이 가능한가요?', '찬물 단독 손세탁을 권장합니다.')] },
    { ...base, id: 'ecobag', name: '데일리 코튼 에코백', brand: '아틀리에 노트', category: '패션잡화 / 가방', price: 19000, images: ['./images/generated-4.png'], description: '면 100%의 오픈형 에코백입니다. 내부 포켓 1개가 있습니다.', originalUrl: 'https://atelier-note.example/products/ecobag-01', dimensions: [{ name: '색상', values: '내추럴, 블랙' }], options: [{ id: 'natural', name: '내추럴', stock: 12 }, { id: 'black', name: '블랙', stock: 8 }], extras: [{ key: '소재', value: '면 100%' }, { key: '크기', value: '가로36 × 세로40 · 손잡이26cm' }, { key: '구성품', value: '에코백 1개 · 내부 포켓 1개' }, { key: '관리방법', value: '찬물 단독 손세탁' }], faqs: [faq('지퍼로 입구를 닫을 수 있나요?', '지퍼가 없는 오픈형입니다. 내부 포켓 1개가 있습니다.'), faq('구성품은 무엇인가요?', '에코백 1개이며 내부 포켓 1개가 있습니다.'), faq('어떻게 관리하나요?', '찬물 단독 손세탁을 권장합니다.')] },
    { ...base, id: 'notebook', startsAt: now + 86_400_000, endsAt: now + 97_200_000, name: 'A5 데일리 노트', brand: '아틀리에 노트', category: '문구 / 노트', price: 6000, images: ['./images/generated-5.png'], description: 'A5 규격의 종이 노트입니다. 한 권당 80페이지이며 2권 구성입니다.', originalUrl: 'https://atelier-note.example/products/notebook-01', dimensions: [{ name: '종류', values: '무지, 도트' }, { name: '구성', values: '2권 세트' }], options: [{ id: 'plain', name: '무지 / 2권 세트', stock: 24 }, { id: 'dot', name: '도트 / 2권 세트', stock: 16 }], extras: [{ key: '규격', value: 'A5 · 148 × 210mm' }, { key: '페이지 수', value: '권당 80페이지(40매)' }, { key: '재질', value: '종이 · 내지 80g/㎡' }, { key: '구성 수량', value: '옵션당 노트 2권' }], faqs: [faq('한 권당 몇 페이지인가요?', '한 권당 80페이지(40매)이며, 한 옵션은 노트 2권 세트입니다.'), faq('한 옵션은 몇 권 구성인가요?', '한 옵션은 같은 종류의 노트 2권 세트입니다.'), faq('규격과 재질은 무엇인가요?', 'A5(148×210mm)이며 내지는 종이 80g/㎡입니다.')] },
    { ...base, id: 'basket', name: '모듈 수납 바구니', brand: '아틀리에 노트', category: '생활잡화 / 수납용품', price: 12000, images: ['./images/generated-3.png'], description: 'PP 재질의 수납 바구니입니다. 소형·대형 두 크기이며 각 1개 구성입니다.', originalUrl: 'https://atelier-note.example/products/basket-01', dimensions: [{ name: '크기', values: '소형, 대형' }, { name: '색상', values: '화이트' }], options: [{ id: 'small', name: '소형 / 화이트', stock: 14 }, { id: 'large', name: '대형 / 화이트', stock: 10 }], extras: [{ key: '크기', value: '소형 25×18×12 / 대형 35×25×18cm' }, { key: '재질', value: 'PP' }, { key: '용도', value: '일반 생활용품 수납' }, { key: '구성품', value: '옵션당 바구니 1개' }, { key: '사용 시 주의', value: '화기·고온을 피하세요. 식품용 아님' }], faqs: [faq('표시된 크기는 외부 치수인가요?', '네, 외부 치수입니다. 소형 25×18×12cm, 대형 35×25×18cm입니다.'), faq('무엇으로 만들었나요?', 'PP 재질이며 옵션당 바구니 1개입니다.'), faq('사용 시 주의사항이 있나요?', '화기·고온을 피하고 일반 생활용품 수납에 사용해 주세요. 식품용 제품이 아닙니다.')] }
  ];
  const users: User[] = [{ id: 'buyer', name: '김서윤', email: 'buyer@example.com', phone: '010-1234-5678', seller: false, admin: false }, { id: 'seller', name: '김민지', email: 'seller@example.com', phone: '010-9876-5432', seller: true, admin: false }, { id: 'admin', name: '운영자', email: 'admin@example.com', phone: '', seller: false, admin: true }, { id: 'applicant', name: '이수진', email: 'paper@example.com', phone: '010-2222-3333', seller: false, admin: false }];
  const order = (i: number, p: Product, status: OrderStatus): Order => ({ id: `SD-${new Date(now).getFullYear()}-00${i + 1}`, userId: 'buyer', sellerId: 'seller', productId: `archive-${p.id}`, holdId: `archive-hold-${i}`, lines: [{ optionId: p.options[0].id, name: p.options[0].name, quantity: 1 }], product: { name: p.name, brand: p.brand, image: p.images[0], category: p.category, originalUrl: p.originalUrl, price: p.price }, shipping: 3000, total: p.price + 3000, address: { ...defaultAddress }, status, createdAt: now - 172_800_000, ...(status === 'shipping' || status === 'delivered' ? { carrier: 'CJ대한통운', tracking: '1234-5678-9012', shippedAt: now - 86_400_000 } : {}), ...(status === 'delivered' ? { deliveredAt: now - 3_600_000, deliveredPlace: '문 앞', processedAt: now - 3_500_000, processedBy: 'seller' } : {}) });
  return { version: 1, auth: initialAuth(), activeUserId: '', mode: 'buyer', users, products, applications: [{ id: 'SD-P-002', userId: 'applicant', displayName: '종이상점', name: '이수진', email: 'paper@example.com', phone: '010-2222-3333', document: { id: 'sample', name: '사업자등록증_종이상점.pdf', size: 1024, uploadedAt: now - 3_600_000 }, bank: '신한은행', account: '000-1234-5678', shippingAddress: '서울시 성동구 성수이로 00', returnAddress: '서울시 성동구 성수이로 00', status: 'pending', submittedAt: now - 3_600_000 }], holds: [], orders: [order(0, products[0], 'preparing'), order(1, products[1], 'shipping'), order(2, products[3], 'delivered')], inquiries: [{ id: 'q-seed', userId: 'buyer', sellerId: 'seller', productId: 'ecobag', productName: '데일리 코튼 에코백', kind: '상품 문의', question: '손잡이 길이를 포함한 높이도 알 수 있나요?', public: false, createdAt: now - 300_000 }], drafts: {}, addresses: { buyer: { ...defaultAddress }, seller: { ...defaultAddress, name: '김민지' } }, sellerSettings: { seller: { displayName: '아틀리에 노트', bank: '신한은행', account: '000-1234-5678', holder: '김민지', shippingAddress: '서울시 성동구 성수이로 00', returnAddress: '서울시 광진구 아차산로 00', notifications: { 신규주문: true, 문의: true, 판매일정: true, 마케팅: false } } }, bookmarks: [], clockOffset: 0, paymentOutcome: 'success', aiOutcome: 'auto' };
}
