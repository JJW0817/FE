# 서버가 켜지면 확인할 순서 (인증)

지금까지는 서버 없이 만들었다. 실제 호출은 한 번도 하지 않았다. 서버가 켜지면 아래 순서대로, **앞 단계가 되어야 다음 단계로** 간다.
브라우저 개발자도구 Network 탭을 열어 두고, 각 단계의 "이렇게 보이면 통과"를 확인한다. 명세는 `docs/api-spec.md` 1절, 공통 규칙은 0절이다.

## 0. 준비

- [ ] `.env.local`에서 `VITE_USE_MOCK`, `VITE_DEMO_LOGIN`, `VITE_MOCK_AUTH`를 **모두 지운다**(하나라도 `true`면 mock 모드가 되어 서버를 호출하지 않는다). `VITE_API_TARGET`을 서버 주소로 맞춘다.
- [ ] `npm run dev`로 띄우고 `http://localhost:5173`으로 접속한다. 로그인 화면에 역할 선택(구매자·판매자·운영자) 데모 버튼이 **보이지 않아야** 한다. 보이면 mock 모드다.
- [ ] 테스트 계정을 준비한다: 구매자 1(가입 테스트용 새 이메일 + 실제 메일 수신 가능), 판매자 1, 운영자 1.
- [ ] **게이트웨이 구성 확인.** 명세에는 일반 Gateway(`:8000`)와 PurchaseGateway(`:8001`)가 따로 있다. 이 단계의 인증 API는 Account 서비스다. Account가 어느 주소 뒤에 있는지, 두 Gateway가 한 호스트의 경로로 합쳐지는지 서버 팀에 확인한다(`docs/api-gap.md`와 인수인계 질문 참고). 인증 단계는 `VITE_API_TARGET` 하나로 가능한 구조여야 한다.

## 1. CSRF 토큰 (모든 인증 단계의 기반)

- [ ] 로그인 화면을 열고 로그인을 시도하면 먼저 `GET /api/v1/auth/csrf`가 호출된다 → 200, 본문 `data.headerName`(`X-XSRF-TOKEN`), `data.token`.
- [ ] 응답 `Set-Cookie`에 `stockdrop_csrf`(Secure 설정이면 `__Host-stockdrop_csrf`)가 있다. Application 탭 Cookies에 보인다.
- [ ] 이어지는 `POST /api/v1/auth/login` 요청 헤더에 `X-XSRF-TOKEN`이 붙어 있다. 없거나 403 `COMMON_CSRF_REJECTED`면 쿠키가 프록시에서 버려진 것이다(쿠키 도메인·Secure·SameSite 설정 점검).

## 2. 회원가입

- [ ] `/signup`에서 이름·이메일 입력 후 **인증번호 요청** → `POST /api/v1/auth/email-verifications` 200, `challengeId` 수신, 메일 도착. 화면에 재전송 60초 카운트다운.
- [ ] 같은 이메일로 60초 안에 재요청하면 앱이 먼저 막고(서버까지 안 감), 서버에서 429 `EMAIL_RATE_LIMITED`가 오면 서버 문구가 그대로 보인다.
- [ ] 이미 가입된 이메일 → 409 `ACCOUNT_EMAIL_ALREADY_EXISTS` 문구가 화면에 보인다.
- [ ] 틀린 인증번호 → 400 `EMAIL_INVALID_CODE` 문구, 입력칸 초기화. 올바른 번호 → `POST /api/v1/auth/email-verifications/confirm` 200, `verificationToken` 저장(화면은 인증 완료 표시).
- [ ] 정보 입력(비밀번호·약관) 후 제출 → `POST /api/v1/auth/signup` **201**, 이어서 자동으로 `POST /api/v1/auth/login`이 호출되어 로그인된 채 가입 완료 화면으로 간다. (가입 API는 토큰을 주지 않는다.)
- [ ] 가입 후 `GET /api/v1/accounts/me`가 호출되어 화면 이름이 서버의 `name`과 같다.
- 참고: 앱이 받는 전화번호는 가입 API에 없어 서버로 보내지 않는다. 비밀번호는 앱 규칙이 8~32자(서버는 8~64자).

## 3. 로그인

- [ ] 구매자 계정 로그인 → `POST /api/v1/auth/login` 200. 응답 `data.accessToken`, `roles: ["BUYER"]`. 응답 `Set-Cookie`에 `stockdrop_refresh`(HttpOnly, `Path=/api/v1/auth`). Application 탭에 보이고 **JS에서는 읽히지 않는다**(콘솔에서 `document.cookie`에 없어야 정상).
- [ ] 로그인 후 홈(`/`)으로 이동한다. `localStorage`의 `stockdrop:v1:live`에 `accessToken`이 **없어야** 한다(토큰은 메모리에만 있다).
- [ ] 판매자 계정(`roles`에 `SELLER`) → `/seller`로, 운영자 계정(`ADMIN`) → `/admin`으로 들어간다. 로그인 전에 보호된 화면(`/my` 등)으로 가려던 경우에는 그 화면으로 돌아간다(`next`).
- [ ] 구매자 계정으로 주소창에 `/#/admin`, `/#/seller/new`를 직접 입력하면 화면 안내 문구("운영자만 사용할 수 있습니다.", "승인된 판매자만 상품을 등록할 수 있습니다.")가 보인다. 서버 호출은 403(`SELLER_ADMIN_REQUIRED` 등)으로 막힌다.
- [ ] 틀린 비밀번호 → 401 `AUTH_INVALID_CREDENTIALS` 문구("이메일 또는 비밀번호가 올바르지 않습니다."). 이때 재발급(`/auth/refresh`) 호출이 **일어나지 않아야** 한다.
- [ ] 반복 실패 → 429 `AUTH_LOGIN_RATE_LIMITED` 문구.
- [ ] 이용 불가 계정 → 403 `AUTH_ACCOUNT_UNAVAILABLE` 문구.

## 4. 새로고침 후 로그인 유지

- [ ] 로그인한 상태에서 새로고침한다. Network에 `GET /auth/csrf` → `POST /auth/refresh` 200이 순서대로 보이고, 로그인 화면으로 튕기지 않는다.
- [ ] 새로고침 직후 보호된 화면의 데이터 호출이 동시에 일어나도 `POST /auth/refresh`는 **한 번만** 나간다(Refresh Token은 호출마다 교체되고 재사용하면 세션이 폐기된다 → 두 번 나가면 `AUTH_REFRESH_REUSED`로 로그아웃된다).
- [ ] 응답마다 `Set-Cookie`의 `stockdrop_refresh` 값이 바뀐다(교체).

## 5. Access JWT 재발급 (만료 시)

Access JWT 수명은 기본 15분이다. 서버 팀에 수명을 1~2분으로 줄인 테스트 환경을 부탁하면 빠르다.

- [ ] 로그인 후 수명이 지날 때까지 기다린 뒤 인증이 필요한 화면(예: `/my`)을 연다. Network에 `GET /accounts/me` **401** → `POST /auth/refresh` 200 → 같은 요청이 **다시 200**으로 이어진다. 화면에는 에러가 보이지 않는다.
- [ ] 같은 요청이 한 번만 재시도된다(무한 반복 없음).
- [ ] 재발급이 거절되는 경우 확인: 다른 탭에서 로그아웃한 뒤 이 탭에서 인증이 필요한 화면을 연다 → `POST /auth/refresh` 401(`AUTH_INVALID_REFRESH_TOKEN`) → 로그인 화면으로 이동한다.
- [ ] 판매자 승인 직후에는 Access JWT의 roles가 바뀌지 않으므로, 승인된 계정이 재발급을 받아 `SELLER`가 반영되는지 확인한다(승인 화면에서 `restoreSession`을 호출한다).

## 6. 로그아웃

- [ ] 로그아웃 → `POST /api/v1/auth/logout` 200(`data: null`), `Set-Cookie`로 `stockdrop_refresh`가 사라진다(`Max-Age=0`). 로그인 화면으로 이동한다.
- [ ] 로그아웃 후 새로고침해도 로그인되지 않는다(`/auth/refresh`가 401).
- [ ] 서버에 닿지 않는 상태에서 로그아웃해도 이 기기의 로그인은 끝난다.

## 7. 비밀번호 재설정

- [ ] `/reset-password`에서 이메일 입력 → 인증번호 요청 `POST /api/v1/auth/password-resets` 200. 가입 여부와 관계없이 같은 응답이 온다(없는 이메일이어도 성공처럼 보임, 메일은 가입자에게만 간다).
- [ ] 인증번호 확인 `POST /api/v1/auth/password-resets/confirm` 200 → `resetToken` 저장.
- [ ] 새 비밀번호 저장 `POST /api/v1/auth/password-resets/complete` 200. 그 계정의 **모든 기기 로그인이 끊긴다**(다른 브라우저에서 새로고침하면 로그아웃). 새 비밀번호로 로그인된다.
- [ ] 인증 없이(또는 가입용 `verificationToken`으로) 완료를 시도하면 400 `AUTH_INVALID_RESET_TOKEN` 계열 문구가 보인다.

## 8. 통과 기준과 알려진 한계

- 위 1~7이 모두 통과하면 인증 연동은 끝난 것이다.
- 이 단계에서 연결한 것은 **인증뿐**이다. 상품·주문·배송지 등 다른 화면은 아직 서버와 연결하지 않았고, mock 모드가 아니면 목업 데이터 없이 비어 보인다. 화면별 연동 대상과 명세와 다른 기존 호출은 `docs/api-gap.md` 3·4절에 있다.
- 비밀번호 변경(`PUT /accounts/me/password`)은 연결만 해 두었고 이 체크리스트에서는 검증하지 않는다. 성공하면 서버가 모든 Refresh 세션을 폐기하므로, 15분 뒤 재발급에서 로그아웃된다.
- 문제가 생기면 Network에서 실패한 요청의 응답 본문 `code`·`traceId`를 서버 팀에 그대로 전달한다.
