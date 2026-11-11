/**
 * 회원 설정 도메인 — 명세 docs/api-spec.md 1·2절 중 내 정보·이름·탈퇴·관심 카테고리·알림 동의/설정 + 가입 선택 항목. Account service(`account`).
 * 화면은 관심 카테고리를 라벨('의류·패션')로 쓰고 서버는 코드(FASHION)를 쓰므로 변환은 여기서 한다.
 */
import { api } from './client';
import type { AccountDto, SignupOptionsDto, WithdrawalEligibilityDto } from './types';

const service = 'account' as const;
const ME = '/v1/accounts/me';

export interface MySettings { name: string; interests: string[]; saleStart: boolean; personalizedRecommendation: boolean; marketing: boolean }

/* ── 카테고리 코드 ↔ 라벨 (GET /v1/signup-options, 인증 없음, 한 번만 받아 캐시) ── */
let optionsCache: Promise<SignupOptionsDto['categories']> | undefined;
export function signupCategories(): Promise<SignupOptionsDto['categories']> {
  optionsCache ??= api.get<SignupOptionsDto>('/v1/signup-options', { service, auth: false }).then(o => o.categories, e => { optionsCache = undefined; throw e; });
  return optionsCache;
}
export const resetSignupCategoryCache = () => { optionsCache = undefined; };

export const mySettingsFromApi = (d: AccountDto, cats: { code: string; label: string }[]): MySettings => ({
  name: d.name, interests: d.interestCategories.map(c => cats.find(x => x.code === c)?.label ?? c),
  saleStart: d.notificationSettings.saleStart, personalizedRecommendation: d.notificationSettings.personalizedRecommendation, marketing: d.marketingConsent.agreed,
});

/* ── API ── */
/** GET /v1/accounts/me — 이름·관심 카테고리(라벨)·알림 설정·광고성 동의 */
export async function fetchMySettings(signal?: AbortSignal): Promise<MySettings> {
  const [me, cats] = await Promise.all([api.get<AccountDto>(ME, { service, signal }), signupCategories()]);
  return mySettingsFromApi(me, cats);
}
/** PATCH /v1/accounts/me — 이름만 수정 가능 */
export const updateMyName = (name: string) => api.patch<null>(ME, { name }, { service });
/** PUT /v1/accounts/me/interests — 라벨 → 코드로 바꿔 전체 교체(빈 배열=전체 해제) */
export async function saveInterests(labels: string[]) {
  const cats = await signupCategories();
  const codes = labels.map(l => cats.find(c => c.label === l)?.code).filter((c): c is string => !!c);
  return api.put<null>(`${ME}/interests`, { interestCategories: codes }, { service });
}
/** PUT /v1/accounts/me/marketing-consent */
export const saveMarketingConsent = (marketingConsent: boolean) => api.put<null>(`${ME}/marketing-consent`, { marketingConsent }, { service });
/** PUT /v1/accounts/me/notification-settings — 두 값 모두 필수 */
export const saveNotificationSettings = (saleStart: boolean, personalizedRecommendation: boolean) => api.put<null>(`${ME}/notification-settings`, { saleStart, personalizedRecommendation }, { service });
/** GET /v1/accounts/me/withdrawal-eligibility — verified=false면 탈퇴 가능으로 보지 않는다 */
export const fetchWithdrawalEligibility = (signal?: AbortSignal) => api.get<WithdrawalEligibilityDto>(`${ME}/withdrawal-eligibility`, { service, signal });
/** DELETE /v1/accounts/me — 성공하면 서버가 Refresh 세션을 폐기하므로 호출한 쪽이 로컬 세션도 끝낸다 */
export const withdrawAccount = (currentPassword: string, reason?: string) => api.delete<{ withdrawnAt: string }>(ME, { service, body: { currentPassword, reason: reason || undefined, confirmed: true } });
