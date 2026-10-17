import { useSyncExternalStore } from 'react';
import { expireHolds, initialAuth, nowOf, seedState } from './domain';
import type { State } from './domain';
const KEY = 'stockdrop:v1';
const listeners = new Set<() => void>();
function read(): State | undefined { try { const value = JSON.parse(localStorage.getItem(KEY) || 'null'); if (value?.version === 1 && Array.isArray(value.users) && Array.isArray(value.products) && Array.isArray(value.orders) && value.addresses && value.drafts) { if (!value.auth) { value.auth = initialAuth(); value.activeUserId = ''; value.mode = 'buyer'; } return value as State; } } catch { /* Recover invalid local data without preventing access. */ } }
let current = read() ?? seedState();
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
  const next = seedState(); localStorage.setItem(KEY, JSON.stringify(next)); current = next; listeners.forEach(l => l());
}
window.addEventListener('storage', event => { if (event.key === KEY) { current = read() ?? seedState(); listeners.forEach(l => l()); } });
export function sweep() { const now = nowOf(current); if (current.holds.some(h => h.status === 'reserved' && h.expiresAt <= now)) mutate(s => { expireHolds(s, now); }); }
