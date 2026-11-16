/**
 * 웹 푸시 도메인 — 명세 docs/api-spec.md 5절 push-configuration·push-subscriptions 4개. 일반 Gateway(`general`).
 * 서버는 VAPID Web Push만 지원한다(iPhone 홈 화면 PWA, endpoint는 web.push.apple.com).
 * 순서: push-configuration → 권한 요청(사용자 동작 안) → PushManager.subscribe → POST. 로그아웃 전에 DELETE 후 브라우저 unsubscribe.
 */
import { api } from './client';

const service = 'general' as const;
const BASE = '/v1/notifications';

export interface PushConfiguration { enabled: boolean; publicKey: string | null }
export interface PushSubscriptionInfo { id: string; active: boolean; expiresAt: string | null; createdAt: string }
/** `PushSubscription.toJSON()` 형식 */
export interface PushSubscriptionBody { endpoint: string; expirationTime?: number | null; keys: { p256dh: string; auth: string } }

/** GET /v1/notifications/push-configuration — enabled=false면 publicKey는 null */
export const getPushConfiguration = (signal?: AbortSignal) => api.get<PushConfiguration>(`${BASE}/push-configuration`, { service, signal });
/** GET /v1/notifications/push-subscriptions — 비활성 포함, 생성 내림차순 */
export const listPushSubscriptions = (signal?: AbortSignal) => api.get<PushSubscriptionInfo[]>(`${BASE}/push-subscriptions`, { service, signal });
/** POST /v1/notifications/push-subscriptions — 같은 계정+endpoint는 기존 구독을 돌려준다 */
export function registerPushSubscription(sub: PushSubscriptionBody) {
  const body: PushSubscriptionBody = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
  if (sub.expirationTime) body.expirationTime = sub.expirationTime; // null은 보내지 않는다(서버는 미래 epoch ms만 받는다)
  return api.post<PushSubscriptionInfo>(`${BASE}/push-subscriptions`, body, { service });
}
/** DELETE /v1/notifications/push-subscriptions/{id} — 이미 비활성이어도 성공 */
export const deletePushSubscription = (id: string) => api.delete<null>(`${BASE}/push-subscriptions/${encodeURIComponent(id)}`, { service });

/** VAPID 공개키(Base64URL) → applicationServerKey */
export function vapidKeyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - base64url.length % 4) % 4);
  const raw = atob(b64); const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
