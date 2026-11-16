/**
 * 회원 설정 도메인 — 명세 docs/api-spec.md 1·2절 중 내 정보·이름·탈퇴·알림 동의/설정. Account service(`account`).
 */
import { api } from './client';
import type { AccountDto, WithdrawalEligibilityDto } from './types';

const service = 'account' as const;
const ME = '/v1/accounts/me';

export interface MySettings { name: string; saleStart: boolean; personalizedRecommendation: boolean; marketing: boolean }

export const mySettingsFromApi = (d: AccountDto): MySettings => ({
  name: d.name ?? '',
  saleStart: d.notificationSettings?.saleStart ?? false, personalizedRecommendation: d.notificationSettings?.personalizedRecommendation ?? false, marketing: d.marketingConsent?.agreed ?? false,
});

/* ── API ── */
/** GET /v1/accounts/me — 이름·알림 설정·광고성 동의 */
export async function fetchMySettings(signal?: AbortSignal): Promise<MySettings> {
  return mySettingsFromApi(await api.get<AccountDto>(ME, { service, signal }));
}
/** PATCH /v1/accounts/me — 이름만 수정 가능 */
export const updateMyName = (name: string) => api.patch<null>(ME, { name }, { service });
/** PUT /v1/accounts/me/marketing-consent */
export const saveMarketingConsent = (marketingConsent: boolean) => api.put<null>(`${ME}/marketing-consent`, { marketingConsent }, { service });
/** PUT /v1/accounts/me/notification-settings — 두 값 모두 필수 */
export const saveNotificationSettings = (saleStart: boolean, personalizedRecommendation: boolean) => api.put<null>(`${ME}/notification-settings`, { saleStart, personalizedRecommendation }, { service });
/** GET /v1/accounts/me/withdrawal-eligibility — verified=false면 탈퇴 가능으로 보지 않는다 */
export const fetchWithdrawalEligibility = (signal?: AbortSignal) => api.get<WithdrawalEligibilityDto>(`${ME}/withdrawal-eligibility`, { service, signal });
/** DELETE /v1/accounts/me — 성공하면 서버가 Refresh 세션을 폐기하므로 호출한 쪽이 로컬 세션도 끝낸다 */
export const withdrawAccount = (currentPassword: string, reason?: string) => api.delete<{ withdrawnAt: string }>(ME, { service, body: { currentPassword, reason: reason || undefined, confirmed: true } });
