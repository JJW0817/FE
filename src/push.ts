import { deletePushSubscription, getPushConfiguration, registerPushSubscription, vapidKeyBytes, type PushSubscriptionBody } from './api/push';
import { errorMessage } from './api';

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
/** 구독 버튼을 보여도 되는지: 서버는 iOS(web.push.apple.com)만 받고, iOS는 홈 화면에 추가한 앱(standalone)에서만 푸시 구독이 된다 */
export const canSubscribePush = () => supported() && isIos() && isStandalone();

/** 이 브라우저가 등록한 서버 구독 ID — 로그아웃 전에 해제할 때 쓴다 */
const KEY = 'stockdrop:push-subscription-id';
/** 마지막 서버 등록 결과(점검 영역 표시용) */
const LAST_KEY = 'stockdrop:push-last-register';
export interface PushRegisterRecord { at: number; ok: boolean; message?: string }
const supported = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
const remember = (r: PushRegisterRecord) => { try { localStorage.setItem(LAST_KEY, JSON.stringify(r)); } catch { /* 표시용이라 무시 */ } };
export const lastPushRegister = (): PushRegisterRecord | null => { try { return JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch { return null; } };

/** 권한이 허용된 상태에서: 서비스 워커 등록 → 브라우저 구독(없으면 새로) → 서버 등록 */
async function subscribeAndRegister(): Promise<'granted' | 'disabled'> {
  const config = await getPushConfiguration();
  if (!config.enabled || !config.publicKey) return 'disabled';
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyBytes(config.publicKey) });
    const saved = await registerPushSubscription(sub.toJSON() as PushSubscriptionBody);
    try { localStorage.setItem(KEY, saved.id); } catch { /* 저장 실패면 로그아웃 때 브라우저 구독만 해제된다 */ }
    remember({ at: Date.now(), ok: true });
    return 'granted';
  } catch (e) { remember({ at: Date.now(), ok: false, message: errorMessage(e) }); throw e; }
}

/**
 * 서버 Web Push 구독. 반드시 사용자 동작(버튼) 안에서 부른다(iPhone 권한 요청 조건).
 * 결과: 'granted' 등록 완료 / 'denied'·'default' 권한 없음 / 'disabled' 서버 푸시 꺼짐 / 'unsupported' 브라우저 미지원
 */
export async function enablePush(): Promise<NotificationPermission | 'disabled' | 'unsupported'> {
  if (!canSubscribePush()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission;
  return subscribeAndRegister();
}

/** 로그인·세션 복원 때: 이미 권한이 허용돼 있으면 조용히 다시 등록한다(로그아웃 때 해제했으므로). 실패는 무시 */
export async function resyncPush() {
  if (!canSubscribePush() || Notification.permission !== 'granted') return;
  await subscribeAndRegister().catch(() => {});
}

/** 점검 영역 '구독 다시 등록': 기존 구독 해제(서버·브라우저) → 새로 구독 → 서버 등록 */
export async function resubscribePush() {
  await disablePush();
  return enablePush();
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

export interface PushDiagnostics { standalone: boolean; ios: boolean; permission: string; sw: string; subscription: string; last: PushRegisterRecord | null }
/** 점검 영역 표시값 */
export async function pushDiagnostics(): Promise<PushDiagnostics> {
  const base = { standalone: typeof window !== 'undefined' && isStandalone(), ios: typeof navigator !== 'undefined' && isIos(), last: lastPushRegister() };
  if (!supported()) return { ...base, permission: typeof Notification === 'undefined' ? '지원 안 함' : Notification.permission, sw: '지원 안 함', subscription: '없음' };
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  const worker = reg?.active ?? reg?.waiting ?? reg?.installing;
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  return {
    ...base, permission: Notification.permission,
    sw: reg ? `등록됨 · scope ${reg.scope} · ${worker?.state ?? '작업자 없음'}${worker?.scriptURL ? ` · ${worker.scriptURL}` : ''}` : '등록 안 됨',
    subscription: sub ? `${sub.endpoint.slice(0, 48)}…` : '없음',
  };
}
