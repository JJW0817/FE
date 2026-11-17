/**
 * 토스 결제창에서 돌아온 뒤의 처리 — 백엔드 결제 확정 흐름(docs/api-spec.md 4절)
 *   결제창 성공 → successUrl(?paymentKey&orderId&amount) → POST /pg/api/v1/orders/{id}/payment-attempts(202, 접수일 뿐)
 *   → 서버가 비동기로 토스 승인·주문 확정 → GET …/checkout 의 state가 CONFIRMED(구매 완료) / FAILED·EXPIRED(실패)
 * 토스는 successUrl의 해시(#) 앞에 쿼리를 붙이기도 해서 location.search와 해시 안 쿼리를 둘 다 읽는다.
 */
import { ApiError } from './client';
import { getCheckout, getCheckoutTerms, requestPayment } from './orders';
import type { OrderCommandDto } from './types';

export const TOSS_RETURN_PATH = { success: '/payments/toss/success', fail: '/payments/toss/fail' } as const;
/** HashRouter 경로라 해시로 돌아오게 한다(서버 rewrite 없이 SPA가 받는다) */
export const tossReturnUrls = (origin: string, pathname: string) => ({ successUrl: `${origin}${pathname}#${TOSS_RETURN_PATH.success}`, failUrl: `${origin}${pathname}#${TOSS_RETURN_PATH.fail}` });

export interface TossParams { paymentKey: string | null; orderId: string | null; amount: number | null; code: string | null; message: string | null }
/** 해시 앞(location.search)과 해시 안 쿼리(#/path?…)를 합쳐 읽는다. 둘 다 있으면 해시 안 값이 우선 */
export function readTossParams(loc: { search: string; hash: string }): TossParams {
  const outer = new URLSearchParams(loc.search), inner = new URLSearchParams(loc.hash.includes('?') ? loc.hash.slice(loc.hash.indexOf('?')) : '');
  const get = (k: string) => inner.get(k) ?? outer.get(k);
  const amount = get('amount');
  return { paymentKey: get('paymentKey'), orderId: get('orderId'), amount: amount !== null && /^\d+$/.test(amount) ? Number(amount) : null, code: get('code'), message: get('message') };
}
/**
 * 토스 orderId 규칙(백엔드 PaymentWork): 승인 요청에 "SD-" + 주문 UUID를 쓴다. 결제창에도 같은 값을 넣어야 토스가 승인한다(다르면 거절 → 주문 실패).
 * 서버가 checkout 응답에 tossOrderId를 내려주면 그 값을 우선 쓴다.
 */
export const TOSS_ORDER_PREFIX = 'SD-';
export const tossOrderIdOf = (orderId: string, fromServer?: string | null) => fromServer || `${TOSS_ORDER_PREFIX}${orderId}`;
/** 토스 orderId → 우리 주문 id (보관값이 없을 때: 아이폰 홈 화면 앱 → 사파리) */
export const orderIdOfToss = (tossOrderId: string) => (tossOrderId.startsWith(TOSS_ORDER_PREFIX) ? tossOrderId.slice(TOSS_ORDER_PREFIX.length) : tossOrderId);
export const hasTossParams = (p: TossParams) => !!(p.paymentKey || p.orderId || p.code);

/* ── 결제창을 열기 직전 보관(같은 탭) ── 아이폰 홈 화면 앱 → 사파리로 열리면 저장소가 달라 비어 있다. 그때는 토스 orderId(=우리 주문 id)와 서버 금액으로 확인한다 */
const PENDING_KEY = 'stockdrop:toss-pending', RETURN_KEY = 'stockdrop:toss-return', SENT_KEY = 'stockdrop:toss-sent';
export interface TossPending { orderId: string; tossOrderId: string; amount: number }
const read = <T>(st: Storage | undefined, k: string): T | null => { try { return JSON.parse(st?.getItem(k) ?? 'null'); } catch { return null; } };
const write = (st: Storage | undefined, k: string, v: unknown) => { try { if (v === null) st?.removeItem(k); else st?.setItem(k, JSON.stringify(v)); } catch { /* 저장 못 해도 서버 상태로 확인한다 */ } };
const ss = () => (typeof sessionStorage === 'undefined' ? undefined : sessionStorage), ls = () => (typeof localStorage === 'undefined' ? undefined : localStorage);
export const rememberTossPending = (p: TossPending | null) => write(ss(), PENDING_KEY, p);
export const readTossPending = () => read<TossPending>(ss(), PENDING_KEY);
/** 돌아온 값(쿼리를 지운 뒤 새로고침·로그인 후 이어서 처리하려고 보관) */
export interface TossReturn extends TossParams { result: 'success' | 'fail' }
export const stashTossReturn = (r: TossReturn | null) => write(ss(), RETURN_KEY, r);
export const readTossReturn = () => read<TossReturn>(ss(), RETURN_KEY);

/** 같은 주문·paymentKey로 payment-attempts를 두 번 보내지 않는다(새로고침·뒤로 가기). requestKey는 처음 만든 값을 다시 써서 서버 멱등도 지킨다 */
interface SentRecord { paymentKey: string; requestKey: string; done: boolean }
export function sentRecord(orderId: string, paymentKey: string, newKey: () => string = () => crypto.randomUUID()): SentRecord {
  const all = read<Record<string, SentRecord>>(ls(), SENT_KEY) ?? {}, cur = all[orderId];
  if (cur && cur.paymentKey === paymentKey) return cur;
  const rec = { paymentKey, requestKey: newKey(), done: false }; write(ls(), SENT_KEY, { ...all, [orderId]: rec }); return rec;
}
export function markSent(orderId: string) { const all = read<Record<string, SentRecord>>(ls(), SENT_KEY) ?? {}; if (all[orderId]) write(ls(), SENT_KEY, { ...all, [orderId]: { ...all[orderId], done: true } }); }

/** 확인 간격: 처음 1분 2초(30번), 이어서 2분 5초(24번) — 최대 약 3분. 넘으면 실패가 아니라 지연 */
export const CONFIRM_POLL_MS = [...Array<number>(30).fill(2000), ...Array<number>(24).fill(5000)];
export type TossOutcome =
  | { kind: 'confirmed'; checkout: OrderCommandDto }
  | { kind: 'failed'; orderId: string; code: string; message?: string; checkout?: OrderCommandDto }
  | { kind: 'delayed'; orderId: string };
const sleep = (t: number) => new Promise(r => setTimeout(r, t));
/** 결과 불명(401·409·429·5xx·네트워크)은 다시 확인한다. 404 등 명확한 오류만 던진다 */
const transient = (e: unknown) => !(e instanceof ApiError) || [401, 409, 429].includes(e.status) || e.status >= 500 || e.code === 'NETWORK';

export interface TossDeps { getCheckout: typeof getCheckout; getTermsVersion: () => Promise<string>; requestPayment: typeof requestPayment; schedule?: number[]; sleep?: (ms: number) => Promise<unknown>; onUpdate?: (d: OrderCommandDto) => void }
export const defaultTossDeps = (): TossDeps => ({ getCheckout, requestPayment, getTermsVersion: async () => (await getCheckoutTerms()).version });

/** 결제창 실패(failUrl): 사용자가 닫은 경우는 취소 */
export const tossFailure = (orderId: string, code: string | null, message: string | null): TossOutcome => ({ kind: 'failed', orderId, code: code || 'PAYMENT_NOT_COMPLETED', message: code === 'PAY_PROCESS_CANCELED' ? '결제를 취소했어요' : message || undefined });

/** 결제창 성공(successUrl) 처리: 주문 찾기 → 금액 확인 → (한 번만) 승인 요청 → 확정까지 확인 */
export async function processTossSuccess(p: TossParams, pending: TossPending | null, deps: TossDeps): Promise<TossOutcome> {
  if (!p.paymentKey || !p.orderId) return { kind: 'failed', orderId: pending?.orderId ?? p.orderId ?? '', code: 'PAYMENT_NOT_COMPLETED', message: '결제 정보를 받지 못했어요' };
  // 토스에 보낸 orderId("SD-" + 주문 id)로 우리 주문을 찾는다
  const orderId = pending && pending.tossOrderId === p.orderId ? pending.orderId : orderIdOfToss(p.orderId);
  let cur = await deps.getCheckout(orderId); deps.onUpdate?.(cur);
  // 금액 확인: 토스가 돌려준 amount가 결제창을 열 때 보낸 금액·서버 주문 금액과 같아야 한다(승인 요청에는 금액을 보내지 않는다 — 서버가 주문 금액으로 승인)
  const expected = pending && pending.orderId === orderId ? pending.amount : cur.totalAmount;
  if (p.amount === null || expected === null || p.amount !== expected || (cur.totalAmount !== null && p.amount !== cur.totalAmount)) return { kind: 'failed', orderId, code: 'AMOUNT_MISMATCH', message: '결제 금액이 주문 금액과 달라 결제를 진행하지 않았어요', checkout: cur };
  const settled = (d: OrderCommandDto): TossOutcome | null => d.state === 'CONFIRMED' ? { kind: 'confirmed', checkout: d } : d.state === 'FAILED' || d.state === 'EXPIRED' ? { kind: 'failed', orderId, code: d.failureCode || (d.state === 'EXPIRED' ? 'EXPIRED' : 'PAYMENT_NOT_COMPLETED'), checkout: d } : null;
  const early = settled(cur); if (early) return early;
  const rec = sentRecord(orderId, p.paymentKey);
  if (!rec.done && cur.state === 'HELD') {
    try { cur = await deps.requestPayment(orderId, { paymentKey: p.paymentKey, termsVersion: cur.termsVersion ?? await deps.getTermsVersion(), requestKey: rec.requestKey }); deps.onUpdate?.(cur); markSent(orderId); }
    catch (e) { if (!transient(e)) throw e; } // 결과 불명 → 아래에서 상태로 확인(같은 requestKey라 다시 보내도 안전)
  }
  for (const wait of deps.schedule ?? CONFIRM_POLL_MS) {
    const done = settled(cur); if (done) return done;
    await (deps.sleep ?? sleep)(wait);
    try { cur = await deps.getCheckout(orderId); deps.onUpdate?.(cur); } catch (e) { if (!transient(e)) throw e; }
  }
  return settled(cur) ?? { kind: 'delayed', orderId };
}
