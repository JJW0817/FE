/**
 * 알림함 도메인 — 명세 docs/api-spec.md 5절 중 알림함 5개. 일반 Gateway(`general`). (웹 푸시 API는 다루지 않는다)
 * 목록 응답은 data.content만 있고 totalPages가 없다.
 */
import { api } from './client';
import { ms } from './mappers';
import type { NotificationDto, NotificationPage } from './types';

const service = 'general' as const;
const BASE = '/v1/notifications';

export type NotificationKind = '구매' | '상품' | '맞춤 추천';
export interface InboxItem { id: string; kind: NotificationKind; title: string; desc: string; ts: number; read: boolean; targetType: NotificationDto['targetType']; targetId: string }

export function notificationFromApi(d: NotificationDto): InboxItem {
  const kind: NotificationKind = d.type.includes('PERSONALIZED') ? '맞춤 추천' : d.targetType === 'ORDER' || d.targetType === 'SELLER_ORDER' ? '구매' : '상품';
  return { id: d.id, kind, title: d.title, desc: d.body, ts: ms(d.occurredAt) ?? Date.parse(d.createdAt), read: !!d.readAt, targetType: d.targetType, targetId: d.targetId };
}
/** 알림 대상 → 앱 경로. SELLER_APPLICATION은 전용 화면이 없어 /apply로 보낸다 */
export function notificationPath(n: Pick<InboxItem, 'targetType' | 'targetId'>): string {
  const id = encodeURIComponent(n.targetId);
  switch (n.targetType) {
    case 'PRODUCT': return `/product/${id}`;
    case 'ORDER': return `/orders/${id}`;
    case 'SELLER_ORDER': return `/seller/orders/${id}`;
    case 'SELLER_PRODUCT': case 'SELLER_PRODUCT_REVISION': return `/seller/product/${id}`;
    default: return '/apply'; // 추측(명세 없음): 입점 신청 상태는 /apply에서 본다
  }
}

/** GET /v1/notifications — 최신순. 조회해도 읽음 상태는 바뀌지 않는다 */
export async function listNotifications(page = 0, size = 50, signal?: AbortSignal): Promise<InboxItem[]> {
  return (await api.get<NotificationPage<NotificationDto>>(BASE, { service, signal, query: { page, size } })).content.map(notificationFromApi);
}
/** GET /v1/notifications/unread-count */
export async function fetchUnreadCount(signal?: AbortSignal): Promise<number> { return (await api.get<{ count: number }>(`${BASE}/unread-count`, { service, signal })).count; }
/** GET /v1/notifications/{id} — 읽음 처리는 하지 않는다 */
export async function getNotification(id: string, signal?: AbortSignal): Promise<InboxItem> { return notificationFromApi(await api.get<NotificationDto>(`${BASE}/${encodeURIComponent(id)}`, { service, signal })); }
/** PATCH /v1/notifications/{id}/read — changed: 처음 1, 이미 읽음 0 */
export const markNotificationRead = (id: string) => api.patch<{ changed: number }>(`${BASE}/${encodeURIComponent(id)}/read`, undefined, { service });
/** PATCH /v1/notifications/read-all */
export const markAllNotificationsRead = () => api.patch<{ changed: number }>(`${BASE}/read-all`, undefined, { service });
