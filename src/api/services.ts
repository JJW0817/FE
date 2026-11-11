/**
 * 서비스별 기본 주소 — 바꾸는 곳은 여기 한 곳뿐이다.
 * 명세(docs/api-spec.md 0.1)의 로컬 주소: 일반 Gateway :8000, PurchaseGateway :8001, Account는 미기재.
 * 지금은 셋 다 `/api`(vite proxy → VITE_API_TARGET). docs/api-gap.md의 게이트웨이 질문이 풀리면 값만 고친다.
 */
export const SERVICE_BASE = {
  /** 인증·회원·배송지·판매자 입점·마이페이지·운영자 입점 심사 */
  account: '/api',
  /** 일반 Gateway — 상품·주문 조회, 결제 설정, 알림, AI·분석 */
  general: '/api',
  /** PurchaseGateway — 주문·결제·문의 쓰기, 판매자 상품·출고, 운영자 상품 심사 */
  purchase: '/api',
} as const;
export type Service = keyof typeof SERVICE_BASE;
