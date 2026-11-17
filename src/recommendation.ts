/**
 * 맞춤 상품 알림 토글 하나 = GA 분석 참여 + personalizedRecommendation. 백엔드는 분석 동의·personalizedRecommendation·마케팅 수신 동의가
 * 모두 켜져 있어야 맞춤 알림을 보낸다(마케팅 동의는 화면의 별도 체크).
 */
export interface RecommendationDeps { saveRecommend: (on: boolean) => Promise<unknown>; enroll: () => Promise<unknown>; withdraw: () => Promise<unknown> }

/** 화면 표시: 둘 다 켜져 있을 때만 켜짐(예전 데이터처럼 서로 다르면 꺼짐으로 보이고, 켜면 둘 다 켜진다) */
export const recommendationOn = (analyticsEnrolled: boolean, personalizedRecommendation: boolean) => analyticsEnrolled && personalizedRecommendation;

/**
 * 토글을 바꿨을 때 두 설정을 같이 저장한다. 켜기: 분석 참여 + personalizedRecommendation true / 끄기: 분석 철회 + false.
 * 하나라도 실패하면 먼저 바꾼 personalizedRecommendation을 서버 원래 값(before)으로 되돌리고 오류를 다시 던진다(화면은 토글을 되돌린다).
 */
export async function applyRecommendation(on: boolean, before: boolean, d: RecommendationDeps): Promise<void> {
  await d.saveRecommend(on);
  try { await (on ? d.enroll() : d.withdraw()); }
  catch (e) { await d.saveRecommend(before).catch(() => {}); throw e; }
}
