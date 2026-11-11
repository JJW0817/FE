/**
 * 개발용 자동 로그인(목업 계정 buyer·seller·admin으로 바로 시작).
 * `.env.local` 등에 `VITE_MOCK_AUTH=true` 를 넣었을 때만 켜진다. 미리보기·운영 배포에서는 설정하지 않는다(꺼짐).
 */
export const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true';
/**
 * mock 모드. 켜면 서버를 호출하지 않고 화면이 목업 데이터(localStorage 상태)로만 동작한다. **기본값은 꺼짐(실제 API)**.
 * 예전 미리보기 플래그(`VITE_DEMO_LOGIN`, `VITE_MOCK_AUTH`)도 mock 모드를 뜻한다 — 이미 이 값으로 배포된 Vercel 미리보기가 그대로 mock으로 보이게 한다.
 * 서버가 연결된 환경에서는 세 변수를 모두 지운다.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true' || MOCK_AUTH || import.meta.env.VITE_DEMO_LOGIN === 'true';
/** 목업 데이터에만 있는 계정 ID. 실제 로그인은 서버의 accountId를 쓴다. */
export const DEMO_ACCOUNT_IDS = ['buyer', 'seller', 'admin', 'applicant'];
/** 역할 선택 데모 로그인(구매자·판매자·운영자). 서버가 없는 mock 모드에서만 보인다. */
export const DEMO_LOGIN = USE_MOCK;
export const DEMO_ACCOUNTS = [{ id: 'buyer', label: '구매자' }, { id: 'seller', label: '판매자' }, { id: 'admin', label: '운영자' }] as const;
