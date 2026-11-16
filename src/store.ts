import { useSyncExternalStore } from 'react';
import { emptyState, expireHolds, initialAuth, nowOf, seedState } from './domain';
import type { State } from './domain';
import { DEMO_ACCOUNT_IDS, DEMO_LOGIN, MOCK_AUTH, STORAGE_TAG, USE_MOCK } from './config';
/** 첫 방문 상태. 자동 로그인(VITE_MOCK_AUTH)이 꺼져 있으면 로그아웃·온보딩 전 상태로 시작한다 */
const seed = () => USE_MOCK ? seedState(Date.now(), true, MOCK_AUTH) : emptyState();
/** mock 모드와 실제 API 모드는 저장소를 나눠, 목업 데이터가 실제 계정 화면에 섞이지 않게 한다 */
const KEY = USE_MOCK ? 'stockdrop:v1' : 'stockdrop:v1:live';
const listeners = new Set<() => void>();
/**
 * 실제 모드는 서버 데이터(상품·주문·문의·신청·배송지)를 저장소에 두지 않는다 — 화면을 열 때 서버에서 받는다.
 * 남기는 것: 로그인 상태·계정, 화면 설정, 작성 중인 상품 초안, 아직 끝나지 않은 결제 대기(5분). 예전 서버 주소의 이미지 URL이 남아 깨지던 문제
 */
const LIVE_KEEP = ['version', 'auth', 'activeUserId', 'users', 'drafts', 'sellerSettings', 'bookmarks', 'clockOffset', 'paymentOutcome', 'aiOutcome'] as const;
export function persisted(s: State): object {
  if (USE_MOCK) return s;
  const now = Date.now(), out: Record<string, unknown> = { tag: STORAGE_TAG };
  for (const k of LIVE_KEEP) out[k] = s[k];
  out.holds = s.holds.filter(h => h.status === 'pending' || h.status === 'reserved' && (h.expiresAt ?? now) > now);
  return out;
}
/** 저장된 실제 모드 값 → 상태(꼬리표가 다르면 버림). 서버 데이터 칸은 빈 값으로 채운다 */
export function restoreLive(value: any): any { return value?.tag === STORAGE_TAG ? { ...emptyState(), ...value, holds: Array.isArray(value.holds) ? value.holds : [] } : null; }
function read(): State | undefined { try { let value = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!USE_MOCK) value = restoreLive(value); if (value?.version === 1 && Array.isArray(value.users) && Array.isArray(value.products) && Array.isArray(value.orders) && value.addresses && value.drafts) { if (!value.auth) { value.auth = initialAuth(); value.activeUserId = ''; }
    // 자동 로그인이 꺼져 있으면, 예전 목업 자동 로그인으로 저장된 세션(목업 계정 ID)은 처음 방문 상태로 되돌린다
    else if (!MOCK_AUTH && DEMO_ACCOUNT_IDS.includes(value.auth.userId) && !(DEMO_LOGIN && value.auth.demo)) { value.auth = initialAuth(); value.activeUserId = ''; }
    return value as State; } } catch { /* Recover invalid local data without preventing access. */ } }
let current = read() ?? seed();
try { localStorage.setItem(KEY, JSON.stringify(persisted(current))); } catch { /* A later write reports storage restrictions. */ }
export const getState = () => current;
export function mutate<T>(fn: (state: State) => T): T {
  const copy = structuredClone(current);
  const result = fn(copy);
  try { localStorage.setItem(KEY, JSON.stringify(persisted(copy))); } catch { throw new Error('저장 공간이 부족하거나 브라우저 저장이 차단되어 있습니다.'); }
  current = copy; listeners.forEach(l => l()); return result;
}
export async function atomic<T>(fn: (state: State) => T): Promise<T> {
  const task = () => { const latest = read(); if (latest) current = merged(latest); return mutate(fn); };
  if (navigator.locks) return navigator.locks.request('stockdrop-state', task);
  return task();
}
export function useStore() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getState, getState); }
export function resetStore() {
  const next = seed(); localStorage.setItem(KEY, JSON.stringify(persisted(next))); current = next; listeners.forEach(l => l());
}
/** 다른 탭·저장소에서 읽은 값에, 실제 모드는 이 탭이 서버에서 받아 둔 데이터를 유지한다 */
const merged = (latest: State): State => USE_MOCK ? latest : { ...latest, products: current.products, applications: current.applications, orders: current.orders, inquiries: current.inquiries, addresses: current.addresses, holds: [...latest.holds, ...current.holds.filter(h => !latest.holds.some(x => x.id === h.id))] };
window.addEventListener('storage', event => { if (event.key === KEY) { const latest = read(); current = latest ? merged(latest) : seed(); listeners.forEach(l => l()); } });
export function sweep() { const now = nowOf(current); if (current.holds.some(h => h.status === 'reserved' && h.expiresAt !== undefined && h.expiresAt <= now)) mutate(s => { expireHolds(s, now); }); }
