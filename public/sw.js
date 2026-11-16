// STOCKDROP 웹 푸시 서비스 워커 (서버 VAPID Web Push)
// 추측(명세 없음): 푸시 payload는 JSON { title, body, notificationId | id }로 가정한다. 형식이 다르면 기본 문구로 띄운다.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const id = data.notificationId || data.id || '';
  event.waitUntil(self.registration.showNotification(data.title || 'STOCKDROP', { body: data.body || '', data: { notificationId: id } }));
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
