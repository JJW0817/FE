/**
 * 개발용 자동 로그인(목업 계정 buyer·seller·admin으로 바로 시작).
 * `.env.local` 등에 `VITE_MOCK_AUTH=true` 를 넣었을 때만 켜진다. 미리보기·운영 배포에서는 설정하지 않는다(꺼짐).
 */
export const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
/** 목업 데이터에만 있는 계정 ID. 실제 로그인은 서버의 accountId를 쓴다. */
export const DEMO_ACCOUNT_IDS = ['buyer', 'seller', 'admin', 'applicant'];
/**
 * 백엔드 연동 전 미리보기용 데모 로그인. `VITE_DEMO_LOGIN=true` 이면 로그인 화면에서 목업 계정(구매자·판매자·운영자)으로
 * 서버 없이 로그인할 수 있다. 시작은 그대로 온보딩 → 웰컴 → 로그인. 백엔드 연동 후에는 변수를 지워 실제 로그인만 허용한다.
 */
export const DEMO_LOGIN = MOCK_AUTH || import.meta.env.VITE_DEMO_LOGIN === 'true';
export const DEMO_ACCOUNTS = [{ id: 'buyer', label: '구매자' }, { id: 'seller', label: '판매자' }, { id: 'admin', label: '운영자' }] as const;
