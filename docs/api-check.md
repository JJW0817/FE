# 서버가 켜지면 확인할 순서 (전체)

지금까지는 서버 없이 만들었다. 실제 호출은 한 번도 하지 않았다. 서버가 켜지면 아래 순서대로, **앞 단계가 되어야 다음 단계로** 간다.
브라우저 개발자도구 Network 탭을 열어 두고, 각 단계의 "이렇게 보이면 통과"를 확인한다. 명세는 `docs/api-spec.md`(공통 규칙 0절), 명세에 없어 mock으로 남긴 기능은 `docs/api-gap.md` 2절이다. 순서: **인증 → 구매자 가입 → 상품 → 주문·결제 → 배송지·문의 → 판매자 입점 → 상품 등록 → 운영자 승인 → 판매**.

## 0. 준비

- [ ] `.env.local`에서 `VITE_USE_MOCK`, `VITE_DEMO_LOGIN`, `VITE_MOCK_AUTH`를 **모두 지운다**(하나라도 `true`면 mock 모드가 되어 서버를 호출하지 않는다). `VITE_API_TARGET`을 서버 주소로 맞춘다.
- [ ] `npm run dev`로 띄우고 `http://localhost:5173`으로 접속한다. 로그인 화면에 역할 선택(구매자·판매자·운영자) 데모 버튼이 **보이지 않아야** 한다. 보이면 mock 모드다.
- [ ] 테스트 계정을 준비한다: 구매자 1(가입 테스트용 새 이메일 + 실제 메일 수신 가능), 판매자 1, 운영자 1.
- [ ] **게이트웨이 구성 확인.** 명세에는 일반 Gateway(`:8000`)와 PurchaseGateway(`:8001`)가 따로 있다. 이 단계의 인증 API는 Account 서비스다. Account가 어느 주소 뒤에 있는지, 두 Gateway가 한 호스트의 경로로 합쳐지는지 서버 팀에 확인한다(`docs/api-gap.md`와 인수인계 질문 참고). 주소가 갈리면 `src/api/services.ts`의 `SERVICE_BASE`(account·general·purchase) 값만 고친다. 각 API가 어느 서비스로 가는지는 도메인 모듈(`src/api/*.ts`)의 `service`에 있다.

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
- 참고: 앱이 받는 전화번호는 가입 API에 없어 서버로 보내지 않는다. 비밀번호는 서버 기준 8~64자(영문·숫자·특수문자). 64자 비밀번호로 가입이 되는지, 65자는 화면에서 막히는지 본다.

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


## 8. 구매자 가입 이후 설정 (회원·알림)

- [ ] 가입 직후 `/categories`에서 카테고리 선택 → `PUT /api/v1/accounts/me/interests` 200.
- [ ] `/notifications/settings` 진입 시 `GET /api/v1/accounts/me`로 판매 시작·맞춤 추천·광고성 동의 값이 채워진다. **알림 받기 시작** → `PUT /accounts/me/notification-settings`, `PUT /accounts/me/marketing-consent` 200. '건너뛰기'도 같은 저장을 하지만 푸시는 구독하지 않는다.
- [ ] **웹 푸시**(iPhone 홈 화면 PWA, HTTPS): '알림 받기 시작' → `GET /notifications/push-configuration`(`enabled`, `publicKey`) → 권한 창 → `POST /notifications/push-subscriptions`(본문 `endpoint`가 `https://web.push.apple.com/...`, `keys.p256dh`·`keys.auth`) 200. `localStorage`의 `stockdrop:push-subscription-id`에 서버 구독 ID가 저장된다. `enabled=false`면 구독 요청 없이 넘어간다.
- [ ] 서버에서 테스트 푸시를 보내면 알림이 뜨고, 누르면 `/?notificationId=UUID`로 열린다 → `GET /notifications/{id}` → `PATCH /notifications/{id}/read` → 대상 화면(상품·주문 등)으로 이동한다. payload 형식(`title`, `body`, `notificationId`)은 추측이니 서버 팀과 맞춘다(`public/sw.js`).
- [ ] 로그아웃하면 `/auth/logout`보다 **먼저** `DELETE /notifications/push-subscriptions/{id}` 200이 나간다. `GET /notifications/push-subscriptions`에서 해당 구독이 `active:false`.
- [ ] `/my`: `GET /accounts/me`, 이름 수정 `PATCH /accounts/me`, 비밀번호 변경 `PUT /accounts/me/password`(8~64자), 탈퇴 전 `GET /accounts/me/withdrawal-eligibility` → `DELETE /accounts/me`.
- [ ] `/notifications`: `GET /notifications`(page·size), `GET /notifications/unread-count`, 항목을 누르면 `PATCH /notifications/{id}/read`, 모두 읽음 `PATCH /notifications/read-all`. 가격 변동·한정 수량 알림 설정은 서버에 없어 이 기기에만 저장된다(mock 유지).

## 9. 상품 (공개 조회)

- [ ] 홈(`/`)·판매 일정(`/schedule`)·달력(`/schedule/calendar`): `GET /api/v1/products`(일반 Gateway) 200, 카드의 가격·재고·판매 시작 시각이 서버 값과 같다. 서버 재고(`live`)가 있으면 앱은 로컬 주문으로 재고를 빼지 않는다.
- [ ] 상품 상세(`/product/:id`): `GET /products/{id}` 200. 없는 ID → 404 문구.
- [ ] 카테고리 필터가 서버 카테고리 이름(`GET /categories`)으로도 맞게 묶인다(앱 카테고리 체계와 다름 — api-gap 2절).
- 함수만 있고 화면 미연결: `GET /products/{id}/options`, `/faqs`, `/products/schedule`, `/categories`. 판매 시작 알림 신청·찜은 API가 없어 mock 유지.

## 10. 주문·결제 (PurchaseGateway)

- [ ] 상세에서 구매 → `POST /api/v1/orders`(`requestKey` 포함) 202/201 → `/checkout/:id`에서 `GET /orders/{id}/checkout`을 2초 간격으로 확인(최대 20회), 상태가 RESERVING → HELD가 되면 결제 단계로 넘어간다. 같은 `requestKey` 재전송은 같은 주문을 돌려준다.
- [ ] 약관 `GET /orders/checkout-terms` 표시, 배송지 선택 → `PATCH /orders/{id}/shipping-address` 200.
- [ ] `GET /payments/client-configuration`의 클라이언트 키로 토스 결제창이 열린다(카드). 성공 리다이렉트 → `POST /orders/{id}/payment-attempts` 202 → `GET /orders/{id}/checkout`이 CONFIRMED.
- [ ] 결제 실패·취소 리다이렉트 → 실패 문구, 재고 확보 시간(`expiresAt`)이 서버 시각 기준으로 줄어든다. 만료 → EXPIRED.
- [ ] `/orders`: `GET /orders` — CONFIRMED 주문만 보인다. `/orders/:id`: `GET /orders/{id}`, 배송 상태·송장.
- mock 유지: 취소·환불·반품·교환·구매 확정(API 없음).

## 11. 배송지·문의

- [ ] `/addresses`: `GET /accounts/me/addresses`, 등록 `POST`, 수정 `PUT /{addressId}`, 삭제 `DELETE`, 기본 지정 `PUT /{addressId}/default`. 첫 배송지는 자동 기본. 빈 선택 필드는 보내지 않는다.
- [ ] 주문 문의(`/orders/:id/inquiry`): 이미지 첨부 → `POST /orders/{order}/inquiry-images` → presigned PUT → `POST .../completion` → `POST /orders/{order}/inquiries`(이미지 ID 포함) 201. 첨부 후 취소하면 `DELETE /inquiry-images/{id}`.
- [ ] `/inquiries`: `GET /orders/inquiries` 목록, 상세 `GET /orders/{id}/inquiries/{inquiryId}`, 추가 메시지 `POST .../messages`, 이미지 열람 `GET .../download`.
- 함수만: 상품 문의 조회·등록(`/products/{id}/inquiries`), 주문별 문의 목록, `editing`. 운영 1:1 문의·사이트 FAQ는 API가 없어 mock 유지.

## 12. 판매자 입점 (구매자 계정으로)

- [ ] `/apply`: 사업자등록증 PDF 첨부 후 신청 → `POST /api/v1/seller-applications`(multipart) 201. `GET /seller-applications/me`로 상태 '심사 중'.
- [ ] 보완 요청을 받은 신청: `GET /seller-applications/{id}/correction-request` 문구 표시 → 보완 제출 `POST /seller-applications/{id}/resubmissions` 200.
- [ ] 제출한 PDF 열람 `GET /seller-applications/{id}/certificate`.
- mock 유지: 상호·대표자 등 사업자 정보, 판매 URL(신청 API에 필드 없음).

## 13. 상품 등록 (판매자 계정, 운영자 승인 뒤)

> 판매자 권한은 운영자 승인(14절) 후에 생긴다. 14절 입점 승인 → `/auth/refresh`로 `SELLER`가 반영됐는지 확인하고 돌아온다.

- [ ] `/seller/new`: `GET /seller/products/registration-metadata` → 초안 `POST /seller/products` → 단계별 저장 `PUT /registration/basic-info`·`details`·`options`·`pricing-shipping`·`schedule`·`faqs`. 매 응답의 `version`을 다음 요청 `expectedVersion`으로 이어받는다(409면 최신을 다시 읽는다).
- [ ] 이미지: `POST /seller/products/{id}/image-uploads` → presigned PUT → `POST .../images/{imageId}/completion` → `PUT .../images`(순서·대표).
- [ ] AI 분석(`/seller/new/ai`): `POST /seller/products/{id}/ai-analyses` → `GET /api/v1/ai/product-analyses/{id}` 2초 간격(최대 30회, 404는 재시도) → 결과 적용.
- [ ] 심사 요청 `POST /seller/products/{id}/review-submissions` → `/seller/products`(`GET /seller/products`)에서 '심사 대기'.
- 함수만: FAQ 개별 추가·수정·삭제, 수정 심사 이력. mock 유지: 정산(수수료), AI 신뢰도·대안.

## 14. 운영자 승인 (운영자 계정)

- [ ] `/admin`: `GET /api/v1/admin/seller-applications` → 상세 `/admin/:id`(`GET .../{applicationId}`). PDF 열람 버튼 → `POST .../certificate-review` → 새 탭에 PDF(팝업 차단 확인). **열람 기록 후에만** 승인·반려 가능.
- [ ] 승인 `POST .../approve` 200 → 신청자 계정이 재발급 후 `/seller`로 들어간다. 반려 `POST .../reject`(사유) → 신청자 화면에 반려 사유.
- [ ] `/admin/products`: `GET /admin/product-reviews`(상태별 3회 조회 합침) → 상세 `GET /{id}`, 이미지 `GET /{id}/images` + `download-url` → 승인·반려 `POST /{id}/decisions`(`expectedVersion`). 409면 최신 상세를 다시 읽는다.
- 함수만: 보완 요청 등록(`POST .../correction-request`), 수정 심사(목록·상세·결정·이미지 4개).

## 15. 판매 (판매 시작 이후)

- [ ] 승인된 상품이 판매 시작 시각에 구매자 홈에 나타나고, 10절 흐름으로 구매자 계정이 주문·결제한다.
- [ ] 판매자 `/seller/orders`: `GET /seller/orders`, `GET /seller/orders/summary` 집계. 상세 `/seller/orders/:id` → 출고 `GET .../fulfillment` → 송장 등록 `POST .../shipment` → 구매자 주문 상세가 '배송 중'. 수동 배송 완료 `POST .../delivery-completion` → '배송 완료'.
- [ ] 판매자 문의함 `/seller/inquiries`: `GET /seller/orders/inquiries`·`/seller/products/inquiries`, 답변 `POST /seller/orders/{order}/inquiries/{id}/answers`, 상품 문의 답변 `PUT /seller/products/{productId}/inquiries/{inquiryId}/answer` → 구매자 문의 상세에 답변.
- [ ] 판매자 마이페이지 `/seller/my`·`/seller/settings/:section`: `GET /sellers/me`, 계좌 `PUT /bank-account`, 담당자 `PUT /contact`, 출고·반품지 `PUT /addresses`, 스토어 `GET·PUT /store`, 로고 `POST·GET·DELETE /store/logo`.
- [ ] 판매 집계 `GET /seller/products/sales-summary` 수치가 주문과 맞는다.
- 함수만: 판매자 주소록 7개, 사업자등록증 재심사·재심사 상태. mock 유지: 정산, 배송 완료 시각·장소·메모, 연락처 전화번호.

## 16. 통과 기준과 알려진 한계

- 1~15가 모두 통과하면 연동은 끝난 것이다. mock 모드(`VITE_USE_MOCK=true`, Vercel 프리뷰)는 서버 없이 그대로 동작한다.
- 연동하지 않은 API: GA 분석 참여 4개(`/ai/analytics/identity`·`profile`, 화면 없음). 명세에 없어 mock으로 남긴 기능은 코드에 `TODO(api-gap)`, 명세가 애매해 추측한 곳은 `추측(명세 없음)`으로 표시했다(`grep -rn "TODO(api-gap)\|추측(명세 없음)" src`).
- 문제가 생기면 Network에서 실패한 요청의 응답 본문 `code`·`traceId`를 서버 팀에 그대로 전달한다.
