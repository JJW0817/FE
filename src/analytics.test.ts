import { beforeEach, describe, expect, it, vi } from 'vitest';
// store.ts가 import 시점에 window·localStorage를 쓴다(node 환경에는 없음)
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
const win: { addEventListener: () => void; removeEventListener: () => void; localStorage: unknown; dataLayer?: unknown[]; gtag?: unknown } = { addEventListener: () => {}, removeEventListener: () => {}, localStorage: globalThis.localStorage };
vi.stubGlobal('window', win);
vi.stubGlobal('document', { createElement: () => ({}), head: { appendChild: () => {} } });
vi.stubEnv('VITE_GA_ID', 'G-TEST');
const { api, ApiError } = await import('./api');
const { initAnalytics, syncAnalyticsIdentity, trackViewItem } = await import('./analytics');
const { login, logout } = await import('./auth');

/** gtag 호출 기록: [명령, ...인자] */
const calls = () => (win.dataLayer ?? []).map(a => Array.from(a as ArrayLike<unknown>));
const ID = { analyticsId: 'uuid-1', consentedAt: 'x' };
const LOGIN = { accessToken: 't', tokenType: 'Bearer', expiresAt: 'x', accountId: 'acc1', roles: ['BUYER'] };
const wire = (identity: () => unknown) => {
  const get = vi.spyOn(api, 'get').mockImplementation(async (path: string) => { if (path.includes('analytics/identity')) return identity(); return { name: '홍' }; });
  const post = vi.spyOn(api, 'post').mockImplementation(async (path: string) => (path.includes('login') ? LOGIN : null));
  const del = vi.spyOn(api, 'delete').mockResolvedValue(null);
  return { get, post, del };
};
const identityCalls = (m: { mock: { calls: unknown[][] } }) => m.mock.calls.filter(c => String(c[0]).includes('analytics/identity'));

beforeEach(() => { vi.restoreAllMocks(); win.dataLayer = []; win.gtag = undefined; });

describe('GA 동의·가명 ID', () => {
  it('시작할 때 동의 기본값은 모두 denied이고 config보다 먼저다', () => {
    initAnalytics();
    const c = calls(), ci = c.findIndex(a => a[0] === 'consent'), cf = c.findIndex(a => a[0] === 'config');
    expect(c[ci]).toEqual(['consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
    expect(ci).toBeLessThan(cf);
  });
  it('로그인 직후 참여 상태를 받아 user_id와 analytics_storage=granted를 적용한다', async () => {
    initAnalytics(); const { get } = wire(() => ID);
    await login('a@b.co', 'Pw1234!!'); await vi.waitFor(() => expect(identityCalls(get)).toHaveLength(1));
    await vi.waitFor(() => expect(calls().some(a => a[0] === 'config' && (a[2] as { user_id?: string }).user_id === 'uuid-1')).toBe(true));
    expect(calls()).toContainEqual(['consent', 'update', { analytics_storage: 'granted' }]);
  });
  it('미참여(404)는 자동 참여시키지 않고 denied·user_id=null', async () => {
    initAnalytics(); const { post } = wire(() => { throw new ApiError('x', 404, 'PERSONALIZATION_NOT_FOUND'); });
    expect(await syncAnalyticsIdentity()).toBeNull();
    expect(identityCalls(post)).toHaveLength(0);
    expect(calls().at(-1)).toEqual(['config', 'G-TEST', { user_id: null, send_page_view: false }]);
    expect(calls()).toContainEqual(['consent', 'update', { analytics_storage: 'denied' }]);
  });
  it('로그아웃은 user_id=null·denied만 하고 철회 API는 부르지 않는다', async () => {
    initAnalytics(); const { post, del } = wire(() => ID);
    await login('a@b.co', 'Pw1234!!'); await logout();
    expect(calls().at(-1)).toEqual(['config', 'G-TEST', { user_id: null, send_page_view: false }]);
    expect(calls()).toContainEqual(['consent', 'update', { analytics_storage: 'denied' }]);
    expect(del).not.toHaveBeenCalled();
    expect(identityCalls(post)).toHaveLength(0);
  });
});

describe('view_item', () => {
  it('item_category는 서버 원문 그대로 보낸다', () => {
    initAnalytics();
    trackViewItem({ id: 'p1', name: '면 티셔츠', category: '반팔 티셔츠', price: 12900 });
    expect(calls().at(-1)).toEqual(['event', 'view_item', { currency: 'KRW', value: 12900, items: [{ item_id: 'p1', item_name: '면 티셔츠', item_category: '반팔 티셔츠', price: 12900 }] }]);
  });
  it('측정 ID가 없으면 gtag를 부르지 않는다', () => {
    initAnalytics(); const before = calls().length; vi.stubEnv('VITE_GA_ID', '');
    trackViewItem({ id: 'p1', name: 'n', category: 'c', price: 1 });
    expect(calls()).toHaveLength(before); vi.stubEnv('VITE_GA_ID', 'G-TEST');
  });
});
