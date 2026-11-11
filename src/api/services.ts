/**
 * 서비스별 기본 주소 — 바꾸는 곳은 여기 한 곳뿐이다.
 * 전부 상대 경로다(절대 주소 금지 — Safari가 다른 사이트 쿠키를 막는다). 같은 origin으로 보내고 뒤에서 넘겨 준다:
 *   /api/…  → Gateway(:8000)          /pg/api/… → PurchaseGateway(:8001), `/pg`는 떼고 전달
 * 배포(Vercel)는 vercel.json rewrites, 로컬은 vite.config proxy(VITE_API_TARGET·VITE_PG_TARGET). docs/tunnel.md 참고.
 * 인증(CSRF·login·refresh·logout)은 반드시 /api 쪽이다 — refresh 쿠키 경로가 /api/v1/auth라서 /pg로 보내면 쿠키가 가지 않는다.
 */
export const SERVICE_BASE = {
  /** 인증·회원·배송지·판매자 입점·마이페이지·운영자 입점 심사 */
  account: '/api',
  /** Gateway — 상품·주문 조회, 결제 설정, 알림, AI·분석 */
  general: '/api',
  /** PurchaseGateway — 주문 생성·결제·체크아웃, 주문 문의 작성·답변, 판매자 상품 등록·관리, 운영자 상품 심사, 배송 처리 */
  purchase: '/pg/api',
} as const;
export type Service = keyof typeof SERVICE_BASE;
