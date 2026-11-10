import { useSyncExternalStore } from 'react';
import { expireHolds, initialAuth, nowOf, seedState } from './domain';
import type { State } from './domain';
import { DEMO_ACCOUNT_IDS, MOCK_AUTH } from './config';
/** 첫 방문 상태. 자동 로그인(VITE_MOCK_AUTH)이 꺼져 있으면 로그아웃·온보딩 전 상태로 시작한다 */
const seed = () => seedState(Date.now(), true, MOCK_AUTH);
const KEY = 'stockdrop:v1';
const listeners = new Set<() => void>();
function read(): State | undefined { try { const value = JSON.parse(localStorage.getItem(KEY) || 'null'); if (value?.version === 1 && Array.isArray(value.users) && Array.isArray(value.products) && Array.isArray(value.orders) && value.addresses && value.drafts) { if (!value.auth) { value.auth = initialAuth(); value.activeUserId = ''; value.mode = 'buyer'; }
    // 자동 로그인이 꺼져 있으면, 예전 목업 자동 로그인으로 저장된 세션(목업 계정 ID)은 처음 방문 상태로 되돌린다
    else if (!MOCK_AUTH && DEMO_ACCOUNT_IDS.includes(value.auth.userId)) { value.auth = initialAuth(); value.activeUserId = ''; value.mode = 'buyer'; }
    return value as State; } } catch { /* Recover invalid local data without preventing access. */ } }
let current = read() ?? seed();
try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* A later write reports storage restrictions. */ }
export const getState = () => current;
export function mutate<T>(fn: (state: State) => T): T {
  const copy = structuredClone(current);
  const result = fn(copy);
  try { localStorage.setItem(KEY, JSON.stringify(copy)); } catch { throw new Error('저장 공간이 부족하거나 브라우저 저장이 차단되어 있습니다.'); }
  current = copy; listeners.forEach(l => l()); return result;
}
export async function atomic<T>(fn: (state: State) => T): Promise<T> {
  const task = () => { const latest = read(); if (latest) current = latest; return mutate(fn); };
  if (navigator.locks) return navigator.locks.request('stockdrop-state', task);
  return task();
}
export function useStore() { return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, getState, getState); }
export function resetStore() {
  const next = seed(); localStorage.setItem(KEY, JSON.stringify(next)); current = next; listeners.forEach(l => l());
}
window.addEventListener('storage', event => { if (event.key === KEY) { current = read() ?? seed(); listeners.forEach(l => l()); } });
export function sweep() { const now = nowOf(current); if (current.holds.some(h => h.status === 'reserved' && h.expiresAt <= now)) mutate(s => { expireHolds(s, now); }); }
