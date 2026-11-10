/**
 * 개발용 자동 로그인(목업 계정 buyer·seller·admin으로 바로 시작).
 * `.env.local` 등에 `VITE_MOCK_AUTH=true` 를 넣었을 때만 켜진다. 미리보기·운영 배포에서는 설정하지 않는다(꺼짐).
 */
export const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
/** 목업 데이터에만 있는 계정 ID. 실제 로그인은 서버의 accountId를 쓴다. */
export const DEMO_ACCOUNT_IDS = ['buyer', 'seller', 'admin', 'applicant'];
