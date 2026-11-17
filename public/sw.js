// STOCKDROP 웹 푸시 서비스 워커 (서버 VAPID Web Push)
// 서버(NotificationService) payload: JSON { notificationId, title, body, targetType, targetId }. 형식이 달라도 기본 문구로 반드시 띄운다
// (iOS는 userVisibleOnly라 알림을 안 띄우면 구독이 끊길 수 있다)

// 새 sw.js가 배포되면 기다리지 않고 바로 바꾼다
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const FALLBACK_BODY = '새 알림이 도착했어요';
function readPayload(event) {
  if (!event.data) return {};
  try { const v = event.data.json(); return v && typeof v === 'object' ? v : v == null ? {} : { body: String(v) }; } catch { /* JSON 아님 */ }
  try { return { body: event.data.text() }; } catch { return {}; }
}
self.addEventListener('push', event => {
  let title = 'STOCKDROP', options = { body: FALLBACK_BODY, data: { notificationId: '' } };
  try {
    const data = readPayload(event);
    if (typeof data.title === 'string' && data.title.trim()) title = data.title;
    if (typeof data.body === 'string' && data.body.trim()) options.body = data.body;
    const id = data.notificationId || data.id;
    options.data = { notificationId: id ? String(id) : '' };
  } catch { /* 기본 문구 */ }
  event.waitUntil(self.registration.showNotification(title, options).catch(() => self.registration.showNotification('STOCKDROP', { body: FALLBACK_BODY })));
});

// 클릭하면 같은 origin의 /?notificationId=UUID로 진입한다(명세). 앱이 로그인 확인 후 알림 상세 API로 이동 대상을 찾는다
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const id = event.notification.data && event.notification.data.notificationId;
  const url = new URL(id ? `?notificationId=${encodeURIComponent(id)}` : './', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    return open ? open.navigate(url).then(c => (c || open).focus()) : self.clients.openWindow(url);
  }));
});
