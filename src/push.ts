import { deletePushSubscription, getPushConfiguration, registerPushSubscription, vapidKeyBytes, type PushSubscriptionBody } from './api/push';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
/** 구독 버튼을 보여도 되는지: 서버는 iOS(web.push.apple.com)만 받고, iOS는 홈 화면에 추가한 앱(standalone)에서만 푸시 구독이 된다 */
export const canSubscribePush = () => supported() && isIos() && isStandalone();

/** 이 브라우저가 등록한 서버 구독 ID — 로그아웃 전에 해제할 때 쓴다 */
const KEY = 'stockdrop:push-subscription-id';
const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;

/**
 * 서버 Web Push 구독. 반드시 사용자 동작(버튼) 안에서 부른다(iPhone 권한 요청 조건).
 * 결과: 'granted' 등록 완료 / 'denied'·'default' 권한 없음 / 'disabled' 서버 푸시 꺼짐 / 'unsupported' 브라우저 미지원
 */
export async function enablePush(): Promise<NotificationPermission | 'disabled' | 'unsupported'> {
  if (!canSubscribePush()) return 'unsupported';
  const config = await getPushConfiguration();
  if (!config.enabled || !config.publicKey) return 'disabled';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;
  const reg = await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(config.publicKey) });
  const saved = await registerPushSubscription(sub.toJSON() as PushSubscriptionBody);
  try { localStorage.setItem(KEY, saved.id); } catch { /* 저장 실패면 로그아웃 때 브라우저 구독만 해제된다 */ }
  return 'granted';
}

/** 로그아웃 전: 서버 구독 해제(DELETE) → 브라우저 unsubscribe. 실패해도 로그아웃은 막지 않는다 */
export async function disablePush() {
  if (!supported()) return;
  try {
    let id: string | null = null;
    try { id = localStorage.getItem(KEY); localStorage.removeItem(KEY); } catch { /* 없음 */ }
    if (id) await deletePushSubscription(id).catch(() => {});
    const reg = await navigator.serviceWorker.getRegistration();
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch { /* 브라우저 구독 해제 실패는 무시 */ }
}
