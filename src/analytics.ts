import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
/** GA4 측정 ID — 없으면(로컬 등) 스크립트를 넣지도, 이벤트를 보내지도 않는다 */
const GA_ID = import.meta.env.VITE_GA_ID;
declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }

/** gtag 스크립트를 동적으로 추가한다. HashRouter라 자동 page_view는 끄고(send_page_view:false) 라우트 변경 때 직접 보낸다 */
export function initAnalytics() {
  if (!GA_ID || window.gtag) return;
  const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`; document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  // gtag는 arguments 객체를 dataLayer에 넣어야 한다(배열이면 무시된다)
  window.gtag = function () { window.dataLayer!.push(arguments); };
  window.gtag('js', new Date()); window.gtag('config', GA_ID, { send_page_view: false });
}

let lastPath = '';
/** 리다이렉트(예 / → /onboarding)는 한 번에 여러 경로를 지나므로, 경로가 바뀐 뒤 잠깐 가만히 있을 때의 마지막 경로만 보낸다 */
const SETTLE_MS = 150;
/** 라우트가 바뀔 때마다 page_view 한 번(같은 경로 연속 전송 없음, 자동 이동은 마지막 화면만) */
export function usePageView() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!GA_ID || !window.gtag) return;
    const path = pathname + search;
    const t = setTimeout(() => {
      if (path === lastPath) return;
      lastPath = path;
      window.gtag?.('event', 'page_view', { page_path: path, page_title: document.title, page_location: location.href });
    }, SETTLE_MS);
    return () => clearTimeout(t); // 그 사이 다른 경로로 바뀌면(리다이렉트) 이전 경로는 보내지 않는다
  }, [pathname, search]);
}
