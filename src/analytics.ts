import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api, ApiError } from './api/client';
import { USE_MOCK } from './config';
/** GA4 측정 ID — 없으면(로컬 등) 스크립트를 넣지도, gtag를 부르지도 않는다 (API 호출은 그대로). 테스트에서 바꿀 수 있게 호출 때 읽는다 */
const gaId = () => import.meta.env.VITE_GA_ID as string | undefined;
const gtag = (...args: unknown[]) => { if (gaId()) window.gtag?.(...args); };
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }

/** gtag 스크립트를 동적으로 추가한다. HashRouter라 자동 page_view는 끄고(send_page_view:false) 라우트 변경 때 직접 보낸다 */
export function initAnalytics() {
  const GA_ID = gaId();
  if (!GA_ID || window.gtag) return;
  const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`; document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  // gtag는 arguments 객체를 dataLayer에 넣어야 한다(배열이면 무시된다)
  window.gtag = function () { window.dataLayer!.push(arguments); };
  // 동의 전에는 전부 거부 — config보다 먼저 선언해야 한다
  window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  window.gtag('js', new Date()); window.gtag('config', GA_ID, { send_page_view: false });
}

/* ── 관심 상품 알림용 분석 참여(가명 ID). 명세 docs/api-spec.md 「GA 분석 참여」. analyticsId는 저장하지 않고 로그인할 때마다 서버에서 다시 받는다 ── */
const IDENTITY = '/v1/ai/analytics/identity';
type Identity = { analyticsId: string; consentedAt: string };
/** 가명 ID를 GA에 적용한다. id가 없으면(미참여·로그아웃·철회) user_id를 비우고 분석 저장을 거부한다 */
export function applyAnalyticsId(id: string | null) {
  gtag('consent', 'update', { analytics_storage: id ? 'granted' : 'denied' });
  gtag('config', gaId(), { user_id: id, send_page_view: false });
}
/** 로그인 직후·로그인 상태로 앱을 열 때. 404는 미참여(자동 참여시키지 않는다). 그 밖의 실패도 분석은 켜지 않는다 */
export async function syncAnalyticsIdentity(): Promise<string | null> {
  if (USE_MOCK) return null;
  let id: string | null = null;
  try { id = (await api.get<Identity>(IDENTITY, { service: 'general' })).analyticsId; }
  catch (e) { if (!(e instanceof ApiError) || ![401, 403, 404].includes(e.status)) throw e; }
  applyAnalyticsId(id); return id;
}
/** 사용자가 토글을 켰을 때만 부른다 */
export async function enrollAnalytics(): Promise<string | null> {
  if (USE_MOCK) return null;
  const id = (await api.post<Identity>(IDENTITY, { analyticsConsent: true }, { service: 'general' })).analyticsId;
  applyAnalyticsId(id); return id;
}
/** 사용자가 토글을 껐을 때만 부른다. 로그아웃은 이걸 부르지 않고 applyAnalyticsId(null)만 한다 */
export async function withdrawAnalytics(): Promise<void> {
  if (USE_MOCK) return;
  await api.delete<null>(IDENTITY, { service: 'general' });
  applyAnalyticsId(null);
}

/** 상품 상세 응답을 받은 뒤 1회. item_category는 서버 문자열 원문 그대로(화면용 변환·상위 분류 금지) */
export function trackViewItem(p: { id: string; name: string; category: string; price: number }) {
  if (USE_MOCK) return;
  gtag('event', 'view_item', { currency: 'KRW', value: p.price, items: [{ item_id: p.id, item_name: p.name, item_category: p.category, price: p.price }] });
}

let lastPath = '';
/** 리다이렉트(예 / → /onboarding)는 한 번에 여러 경로를 지나므로, 경로가 바뀐 뒤 잠깐 가만히 있을 때의 마지막 경로만 보낸다 */
const SETTLE_MS = 150;
/** 라우트가 바뀔 때마다 page_view 한 번(같은 경로 연속 전송 없음, 자동 이동은 마지막 화면만) */
export function usePageView() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!gaId() || !window.gtag) return;
    const path = pathname + search;
    const t = setTimeout(() => {
      if (path === lastPath) return;
      lastPath = path;
      gtag('event', 'page_view', { page_path: path, page_title: document.title, page_location: location.href });
    }, SETTLE_MS);
    return () => clearTimeout(t); // 그 사이 다른 경로로 바뀌면(리다이렉트) 이전 경로는 보내지 않는다
  }, [pathname, search]);
}
