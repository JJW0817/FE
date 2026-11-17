import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** public/sw.js를 가짜 self로 실행해 push 이벤트 처리를 본다 */
function load(showFail = false) {
  const handlers: Record<string, (e: unknown) => void> = {}, shown: [string, { body?: string; data?: { notificationId: string } }][] = [];
  const self = {
    addEventListener: (t: string, f: (e: unknown) => void) => { handlers[t] = f; }, skipWaiting: () => {}, clients: { claim: async () => {} },
    registration: { showNotification: async (t: string, o: never) => { shown.push([t, o]); if (showFail && shown.length === 1) throw new Error('x'); } },
  };
  new Function('self', readFileSync('public/sw.js', 'utf-8'))(self);
  const push = async (data: { json: () => unknown; text: () => string } | null) => { let p: Promise<unknown> = Promise.resolve(); handlers.push({ data, waitUntil: (x: Promise<unknown>) => { p = x; } }); await p; };
  return { push, shown };
}
const json = (v: unknown) => ({ json: () => v, text: () => JSON.stringify(v) });

describe('sw.js push', () => {
  it('서버 payload(title·body·notificationId)를 그대로 띄운다', async () => {
    const { push, shown } = load(); await push(json({ notificationId: 'n1', title: '판매 시작', body: '상품', targetType: 'PRODUCT', targetId: 'p' }));
    expect(shown).toEqual([['판매 시작', { body: '상품', data: { notificationId: 'n1' } }]]);
  });
  it('내용이 없거나 JSON이 아니거나 null이어도 기본 문구로 띄운다', async () => {
    const { push, shown } = load();
    await push(null); await push(json(null)); await push({ json: () => { throw new Error('x'); }, text: () => '텍스트' }); await push({ json: () => { throw new Error('x'); }, text: () => { throw new Error('y'); } });
    expect(shown.map(s => [s[0], s[1].body])).toEqual([['STOCKDROP', '새 알림이 도착했어요'], ['STOCKDROP', '새 알림이 도착했어요'], ['STOCKDROP', '텍스트'], ['STOCKDROP', '새 알림이 도착했어요']]);
  });
  it('showNotification이 실패하면 기본 문구로 한 번 더', async () => {
    const { push, shown } = load(true); await push(json({ title: 't', body: 'b' }));
    expect(shown.map(s => s[0])).toEqual(['t', 'STOCKDROP']);
  });
});
