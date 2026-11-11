# STOCKDROP 백엔드 API 명세 (프론트 연동용 정리)

- 출처: Notion `🔗 API 명세` 페이지의 인라인 DB `API 명세`. 행 147개를 본문까지 전부 읽어 정리했다(총 147 / 읽음 147).
- Notion의 `서비스`, `BE 상태`, `FE 상태`, `Front`, `Back` 속성은 무시했다. 상태와 무관하게 전부 연동 대상으로 본다. 단 `/internal/*` 2건과 `예시` 1건은 프론트가 호출할 수 없거나 실제 API가 아니라서 12절에 따로 모았다. 연동 대상은 144개다.
- 모든 예시는 명세의 가상 데이터다. 실제 서버 호출로 검증한 내용이 아니다("현재 소스 구현 기준"이라고 명시된 행도 많다).

## 0. 공통

### 0.1 기본 주소

| 구분 | 명세에 적힌 로컬 주소 | 쓰는 API |
|---|---|---|
| 일반 Gateway | `http://localhost:8000` (서비스 직접 포트 8082 상품 조회, 8084 결제 설정, 8085 주문 조회, 8086 AI, 8087 알림) | 상품·주문 **조회**, 결제 설정, 알림, AI·분석 |
| PurchaseGateway | `http://localhost:8001` (서비스 직접 포트 8081 상품 Command, 8083 주문 Command) | 구매자 상품 문의 등록, 주문 생성·결제·배송지 변경·주문 문의 쓰기, 판매자 상품·출고, 운영자 상품 심사 |
| Account | 명세에 주소 미기재 | 인증, 회원, 배송지, 판매자 입점·마이페이지, 운영자 입점 심사 |

- 앱은 기본 주소를 `/api` 하나로 쓴다. 로컬은 vite proxy가 `VITE_API_TARGET`으로 넘긴다. 명세의 모든 경로는 `/api/v1/...` 형식이다.
- 위 세 갈래가 실제로 한 호스트 뒤에 있는지, 경로로 나뉘는지는 명세만으로 알 수 없다 (`docs/api-gap.md` 확인 사항).

### 0.2 인증 방식

| 항목 | 내용 |
|---|---|
| Access JWT | `POST /api/v1/auth/login` 응답 `data.accessToken` (`tokenType: "Bearer"`, 기본 15분, `expiresAt` 제공). 요청 헤더 `Authorization: Bearer <accessToken>` |
| 토큰 위치 | Access는 응답 본문에서 받아 앱이 보관한다(메모리). Refresh는 **HttpOnly 쿠키** `stockdrop_refresh` (Secure 설정 시 `__Secure-stockdrop_refresh`), `Path=/api/v1/auth`, 14일. JS에서 읽을 수 없고 모든 요청에 `credentials: 'include'`가 필요하다 |
| 재발급 | `POST /api/v1/auth/refresh` (본문 없음). Refresh 쿠키 + CSRF 쿠키 + `X-XSRF-TOKEN` 헤더. 호출마다 Refresh Token 교체, 이전 토큰 재사용 시 세션 폐기(401 `AUTH_REFRESH_REUSED`). 세션 절대 만료(14일)는 연장되지 않는다. 응답은 로그인과 같은 형태(`accessToken`, `expiresAt`, `accountId`, `roles`) |
| CSRF | 로그인 전에 `GET /api/v1/auth/csrf` → `data.headerName`("X-XSRF-TOKEN"), `data.token`. CSRF 쿠키(`stockdrop_csrf`, Secure 설정 시 `__Host-stockdrop_csrf`)도 함께 내려온다. **login, logout, refresh** 호출에 이 헤더가 필수다 (403 `COMMON_CSRF_REJECTED`) |
| 로그아웃 | `POST /api/v1/auth/logout` — Refresh 세션 폐기, 쿠키 없어도 성공. 이미 발급된 Access JWT는 만료까지 유효하다 |
| 역할 | 응답 `roles[]`: `BUYER`, `SELLER`, `ADMIN`. 판매자 승인 직후 기존 JWT의 roles는 바뀌지 않아 **재발급이 필요**하다. 비밀번호 변경·재설정·탈퇴는 모든 Refresh 세션을 폐기한다 |
| 공개 API | 상품 조회 계열은 Authorization 생략 가능. 단 **잘못된/만료된 Bearer를 보내면 공개 API도 401** |
| 가입 | `POST /api/v1/auth/signup`은 JWT를 발급하지 않는다. 가입 후 별도로 로그인해야 한다 |

### 0.3 공통 응답·에러 형식

성공 (JSON):

```json
{ "success": true, "code": "COMMON_SUCCESS", "message": "요청이 성공했습니다.", "data": { } }
```

- 생성은 `code: "COMMON_CREATED"` (HTTP 201). 일부 쓰기는 명세상 200(주문 문의 등록, 상품 문의 답변 등), 주문 생성·결제 요청·AI 점검 요청은 **202 접수**(확정 아님).
- 응답이 `ApiResponse`로 감싸지지 않는 경우: 사업자등록증 PDF, 스토어 로고 이미지(바이너리), `/internal/*`.

에러 (성공 형식과 별개, `success` 필드 없음):

```json
{ "code": "COMMON_INVALID_REQUEST", "message": "요청값이 올바르지 않습니다.", "traceId": "…", "violations": [{ "field": "email", "message": "입력값을 확인해 주세요." }] }
```

- 입력 검증 오류는 `violations`에 필드별로 담긴다. 그 외 오류는 `violations: []`.
- 공통 코드: `COMMON_INVALID_REQUEST`(400), `COMMON_INVALID_PARAMETER_TYPE`(400, UUID·enum·날짜 바인딩), `COMMON_UNAUTHORIZED`(401), `COMMON_FORBIDDEN`(403), `COMMON_CSRF_REJECTED`(403), `COMMON_RESOURCE_NOT_FOUND`(404), `COMMON_NOT_ACCEPTABLE`(406), `COMMON_SERVICE_UNAVAILABLE`(503), `COMMON_INTERNAL_SERVER_ERROR`(500).
- 도메인별 코드는 아래 표 `에러` 칸에 적었다. 접두사: `AUTH_`, `EMAIL_`, `ACCOUNT_`, `ADDRESS_`, `SELLER_`, `PRODUCT_`, `ORDER_`, `ORDER_QUERY_`, `TERMS_`, `NOTIFICATION_`, `AI_`, `PERSONALIZATION_`.

### 0.4 목록·페이지·시각 규칙

| 종류 | 목록 위치 | 페이지 필드 |
|---|---|---|
| 상품 공개 조회, 상품 문의, 판매자 상품, 운영자 상품 심사(최초) | `data.items` | `page`(0부터), `size`, `totalElements`, `totalPages` (+ 상품 조회는 `serverTime`) |
| 주문·주문 문의 조회(구매자·판매자), 운영자 입점 신청 | `data.content` | `page`, `size`, `totalElements`, `totalPages` |
| 알림함 | `data.content` | `page`, `size`, `totalElements` (**`totalPages` 없음**) |
| 카테고리 | `data.categories` | 없음 |
| 옵션·FAQ·배송지·주소록·이미지·수정 심사 | `data` 자체가 배열 | 없음 |

- 시각은 ISO 8601 UTC 문자열. 금액은 원 단위 정수. `page`는 0부터, `size`는 1~100(기본 20).
- Query 조회 모델은 Kafka로 반영되어 **지연될 수 있다**. 결제 직후 주문 조회가 비어 있어도 실패로 판단하지 말고 `GET /api/v1/orders/{id}/checkout`으로 확인한다.

### 0.5 멱등·낙관적 잠금·업로드

- 멱등 키(`requestKey`, UUID): 주문 생성, 결제 요청, 주문 문의 등록, 추가 메시지, 판매자 답변. 같은 동작을 재시도할 때 같은 키·같은 본문을 보낸다.
- 낙관적 잠금: 상품·주문·문의 변경은 직전 조회 응답의 `version`을 `expectedVersion`으로 보낸다(불일치 409). 주문은 목록·상세의 `sourceVersion`이 아니라 Command 원본 조회(`checkout`, `fulfillment`)의 `version`을 쓴다.
- 파일: 서류·로고는 `multipart/form-data`(Content-Type 직접 지정 금지, 파일을 Base64·JSON에 넣지 않음). 상품·문의 이미지는 업로드 권한 발급 → 반환된 URL에 `PUT`(S3에는 Bearer 토큰을 보내지 않음) → 완료 확인 순서다.
- 서버 시각: 판매·확보 만료 카운터는 응답의 `serverTime`·`expiresAt`을 기준으로 계산한다.

---

## 1. 인증

### 인증

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 로그인 전 CSRF 토큰 준비 | GET | /api/v1/auth/csrf | 없음 (인증 없음) | headerName("X-XSRF-TOKEN"), token. CSRF 쿠키 Set-Cookie(HttpOnly, Path=/) | 400 COMMON_INVALID_REQUEST, 500 |
| 가입 인증번호 발송 | POST | /api/v1/auth/email-verifications | body: email(최대 320자). 인증 없음. 유효 5분, 재요청 60초 | challengeId(UUID), expiresAt, resendAvailableAt | 400 COMMON_INVALID_REQUEST, 409 ACCOUNT_EMAIL_ALREADY_EXISTS, 429 EMAIL_RATE_LIMITED, 503 EMAIL_DELIVERY_FAILED |
| 인증번호 확인 | POST | /api/v1/auth/email-verifications/confirm | body: email, challengeId(UUID), code(숫자 6자리). 인증 없음 | verificationToken, expiresAt(15분). 가입용 verificationToken과 재설정용 resetToken은 서로 대체 불가 | 400 EMAIL_INVALID_CHALLENGE / EMAIL_INVALID_CODE / EMAIL_CODE_EXPIRED, 409 EMAIL_ALREADY_VERIFIED, 429 EMAIL_ATTEMPTS_EXCEEDED |
| 이메일 로그인 | POST | /api/v1/auth/login | body: email(≤320), password(≤64자, UTF-8 ≤72바이트). 헤더 X-XSRF-TOKEN + CSRF 쿠키(stockdrop_csrf, Secure면 __Host-stockdrop_csrf) 필수. credentials 포함 | accessToken, tokenType("Bearer"), expiresAt(15분), accountId, roles[]("BUYER" 등). Refresh는 HttpOnly 쿠키(Path=/api/v1/auth, 14일) | 400, 401 AUTH_INVALID_CREDENTIALS, 403 AUTH_ACCOUNT_UNAVAILABLE / COMMON_CSRF_REJECTED, 429 AUTH_LOGIN_RATE_LIMITED |
| 현재 로그인 세션 종료 | POST | /api/v1/auth/logout | 본문 없음. X-XSRF-TOKEN + CSRF 쿠키 + Refresh 쿠키(stockdrop_refresh, Secure면 __Secure-stockdrop_refresh). 쿠키 없어도 성공 | data=null. Refresh 쿠키 Max-Age=0. Access JWT는 만료까지 유효 | 400, 403 COMMON_CSRF_REJECTED, 500 |
| 비밀번호 재설정 인증번호 요청 | POST | /api/v1/auth/password-resets | body: email(≤320). 인증 없음. 가입 여부와 무관하게 같은 응답 | challengeId, expiresAt, resendAvailableAt | 400, 429 EMAIL_RATE_LIMITED, 500 |
| 새 비밀번호 저장 | POST | /api/v1/auth/password-resets/complete | body: email, resetToken(Base64URL 43자, 일회용), newPassword(8~64자, 영문+숫자+특수문자, UTF-8 ≤72바이트). 인증 없음 | data=null. 모든 Refresh 세션 폐기, Refresh 쿠키 제거(Max-Age=0). 발급된 Access JWT 즉시 회수는 안 함 | 400 COMMON_INVALID_REQUEST / EMAIL_INVALID_PROOF / AUTH_INVALID_RESET_TOKEN, 403 AUTH_ACCOUNT_UNAVAILABLE |
| 비밀번호 재설정 인증번호 확인 | POST | /api/v1/auth/password-resets/confirm | body: email, challengeId, code(6자리). 인증 없음 | resetToken, expiresAt(15분) | 400 EMAIL_INVALID_CHALLENGE / EMAIL_INVALID_CODE / EMAIL_CODE_EXPIRED, 409 EMAIL_ALREADY_VERIFIED, 429 EMAIL_ATTEMPTS_EXCEEDED |
| Access JWT 재발급 | POST | /api/v1/auth/refresh | 본문 없음. Refresh 쿠키 + CSRF 쿠키 + X-XSRF-TOKEN. 인증 헤더 없음 | accessToken, tokenType, expiresAt, accountId, roles[]. Refresh 토큰 매번 교체(재사용 시 세션 폐기), 절대 만료 연장 안 함 | 401 AUTH_INVALID_REFRESH_TOKEN / AUTH_REFRESH_REUSED, 403 AUTH_ACCOUNT_UNAVAILABLE / COMMON_CSRF_REJECTED, 400, 500 |
| 이메일 회원가입 | POST | /api/v1/auth/signup | body: email, password(8~64, 영문+숫자+특수), name(≤100), verificationToken, interestCategories?(코드 배열 ≤12), notificationSettings?{saleStart, personalizedRecommendation}, marketingConsent?. 인증 없음 | 201 COMMON_CREATED. accountId, email, name, emailVerifiedAt, status("ACTIVE"), roles["BUYER"]. JWT 미발급(가입 후 별도 로그인) | 400 COMMON_INVALID_REQUEST / EMAIL_INVALID_PROOF, 409 ACCOUNT_EMAIL_ALREADY_EXISTS |
| 회원가입 선택 항목 조회 | GET | /api/v1/signup-options | 없음. 인증 없음 | categories[{code,label}] 12개(FASHION 의류·패션, APPLIANCES 가전제품, ELECTRONICS 전자기기, HOUSEHOLD 생활용품, INTERIOR 인테리어·가구, TOOLS 공구·자재, FOOD 식품·음료, BEAUTY 뷰티·헬스, SPORTS 스포츠·레저, STATIONERY 문구·도서, KIDS 유아·아동, OTHER 기타), notificationTypes["SALE_START","PERSONALIZED_RECOMMENDATION"], marketingConsentRequiredForPromotionalNotifications(bool) | 400, 500 |

## 2. 회원·배송지

### 회원(accounts) / 배송지

공통 인증: 사용자 Access JWT (Authorization: Bearer). 401 COMMON_UNAUTHORIZED, 403 AUTH_ACCOUNT_UNAVAILABLE. 배송지 API는 BUYER 권한 필수(403 ADDRESS_BUYER_REQUIRED).

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 회원 탈퇴 | DELETE | /api/v1/accounts/me | body: currentPassword(≤64), reason?(≤200), confirmed(true만 허용). Access JWT | withdrawnAt. 모든 Refresh 세션 폐기+쿠키 제거 | 400, 401 COMMON_UNAUTHORIZED / AUTH_INVALID_CREDENTIALS(비번 불일치), 403 AUTH_ACCOUNT_UNAVAILABLE, 409 ACCOUNT_WITHDRAWAL_BLOCKED, 503 ACCOUNT_WITHDRAWAL_CHECK_UNAVAILABLE |
| 내 정보와 설정 조회 | GET | /api/v1/accounts/me | 없음. Access JWT | accountId, email, name, roles[], interestCategories[](코드), notificationSettings{saleStart,personalizedRecommendation}, marketingConsent{agreed,agreedAt,withdrawnAt,updatedAt} | 401, 403 |
| 내 이름 수정 | PATCH | /api/v1/accounts/me | body: name(≤100). Access JWT | data=null | 400, 401, 403 |
| 내 배송지 목록 조회 | GET | /api/v1/accounts/me/addresses | 없음. BUYER | data=배열 [{addressId,label,recipientName,recipientPhone,postalCode,roadAddress,detailAddress,deliveryMemo,defaultAddress,createdAt,updatedAt}] (없으면 []) | 401, 403 ADDRESS_BUYER_REQUIRED |
| 배송지 등록 | POST | /api/v1/accounts/me/addresses | body: label(≤50), recipientName(≤100), recipientPhone(국내), postalCode(숫자5), roadAddress(≤200), detailAddress?(≤200), deliveryMemo?(≤500). 첫 배송지는 자동 기본. 카카오 주소검색은 프론트 | 201. addressId, defaultAddress. Location 헤더 | 400, 401, 403 ADDRESS_BUYER_REQUIRED |
| 배송지 삭제 | DELETE | /api/v1/accounts/me/addresses/{addressId} | path addressId(UUID). 다른 배송지가 남아 있으면 기본 변경 후 삭제 | data=null | 401, 403, 404 ADDRESS_NOT_FOUND, 409 ADDRESS_DEFAULT_CHANGE_REQUIRED |
| 내 배송지 단건 조회 | GET | /api/v1/accounts/me/addresses/{addressId} | path addressId | 목록 항목과 동일 필드 | 401, 403, 404 ADDRESS_NOT_FOUND |
| 선택한 배송지 수정 | PUT | /api/v1/accounts/me/addresses/{addressId} | path addressId + body 등록과 동일(label, recipientName, recipientPhone, postalCode, roadAddress 필수 / detailAddress, deliveryMemo 선택). BUYER | data=null | 400, 401, 403 ADDRESS_BUYER_REQUIRED, 404 ADDRESS_NOT_FOUND |
| 기본 배송지 지정 | PUT | /api/v1/accounts/me/addresses/{addressId}/default | path addressId. 본문 없음. BUYER | data=null | 401, 403, 404 ADDRESS_NOT_FOUND |
| 관심 카테고리 전체 변경 | PUT | /api/v1/accounts/me/interests | body: interestCategories(코드 배열 ≤12, 필수, 빈 배열=전체 해제, null/생략=400) | data=null | 400 COMMON_INVALID_REQUEST, 401 |
| 광고성 알림 동의 또는 철회 | PUT | /api/v1/accounts/me/marketing-consent | body: marketingConsent(bool, 필수). 브라우저 푸시 권한과 별개 | data=null | 400, 401 |
| 알림 유형 설정 변경 | PUT | /api/v1/accounts/me/notification-settings | body: saleStart(bool), personalizedRecommendation(bool) 둘 다 필수 | data=null | 400, 401 |
| 현재 비밀번호로 비밀번호 변경 | PUT | /api/v1/accounts/me/password | body: currentPassword(≤64), newPassword(8~64, 영문+숫자+특수) | data=null. 모든 Refresh 세션 폐기+쿠키 제거. 기존 Access JWT는 만료까지 유효 | 400, 401 COMMON_UNAUTHORIZED / AUTH_INVALID_CREDENTIALS, 403 AUTH_ACCOUNT_UNAVAILABLE |
| 회원 탈퇴 가능 여부 조회 | GET | /api/v1/accounts/me/withdrawal-eligibility | 없음 | verified, canWithdraw, activeOrders, activeSales, pendingSettlements. verified=false면 거래 수가 null일 수 있고 탈퇴 가능으로 해석 금지 | 401, 403 |

## 3. 상품(공개 조회·상품 문의)

### 상품(공개 조회)

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 공개 상품 상세 조회 | GET | /api/v1/products/{id} | path id(UUID). 인증 선택(잘못된 Bearer는 401) | id, sellerId, name, description, brandOrStore, category, sourceUrl, price, shippingFee, dispatchBusinessDays, perAccountLimit, shippingNotice, purchaseNotice, disposalReason, attributes[{name,value}], dimensions[{name,values[]}], options[{id,label,selections{},availableQuantity}], images[{id,objectKey,url(5분 유효, 이미지 비활성 시 null),contentType,position,representative}], faqs[{id,question,answer,confirmedAt}], status(UPCOMING/ON_SALE/SOLD_OUT/ENDED), startsAt, endsAt, soldOutAt, stock{initialQuantity,confirmedQuantity,availableQuantity,approximate}, metadata{version,occurredAt,projectedAt}, canAttemptPurchase, serverTime | 400, 401, 404(없거나 비공개; 승인 직후 이벤트 미반영 시 404 가능), 500 |

공통(공개 조회): 일반 Gateway 기본 로컬 http://localhost:8000 (서비스 직접 포트 8082). 비로그인 가능. Authorization 생략 가능하나 잘못된 Bearer를 보내면 공개 API도 401. 목록은 data.items, 카테고리는 data.categories, 옵션/FAQ는 data 자체가 배열. 에러는 400 COMMON_INVALID_REQUEST(타입 오류는 COMMON_INVALID_PARAMETER_TYPE), 401 COMMON_UNAUTHORIZED, 404 COMMON_RESOURCE_NOT_FOUND, 500.

공통(구매자 쓰기): PurchaseGateway 기본 로컬 http://localhost:8001 (서비스 직접 포트 8081). BUYER JWT. 403 COMMON_FORBIDDEN, 404 PRODUCT_NOT_FOUND.

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 공개 상품 카테고리 필터 목록 조회 | GET | /api/v1/categories | 없음 | categories[string] (카테고리 이름 문자열 배열, 예 "의류"). 공개 조회 모델에 있는 이름만 → 상품 없으면 빈 배열. 등록용 전체 카테고리는 /seller/products/registration-metadata | 401, 500 |
| 공개 상품 목록 및 검색 | GET | /api/v1/products | query(모두 선택): keyword(≤100), category(정확일치 이름), status(UPCOMING/ON_SALE/SOLD_OUT/ENDED), sort(NEWEST/ENDING_SOON/PRICE_ASC/PRICE_DESC, 기본 NEWEST), page(0~, 기본 0), size(1~100, 기본 20), startsFrom/startsTo(UTC ISO, from 포함·to 미포함) | items[{id,name,brandOrStore,category,price,image{id,objectKey,url,contentType,position,representative},status,startsAt,endsAt,soldOutAt,stock{initialQuantity,confirmedQuantity,availableQuantity,approximate},metadata{version,occurredAt,projectedAt}}], page,size,totalElements,totalPages,serverTime | 400, 401, 500 |
| 공개 상품 판매 일정 달력 조회 | GET | /api/v1/products/schedule | query: from(yyyy-MM-dd, 기본 KST 오늘), to(기본 다음 주 일요일, 초과 불가, from~to ≤30일, to≥from). 날짜 KST 기준 | from,to,zone("Asia/Seoul"),days[{date,productCount,firstStartsAt}](상품 없는 날은 빠질 수 있음),serverTime. 날짜 클릭 시 목록은 startsFrom/startsTo에 KST 날짜 UTC 경계 전달 | 400, 401, 500 |
| 공개 상품 검증 FAQ 조회 | GET | /api/v1/products/{id}/faqs | path id | data=배열 [{id,question,answer,confirmedAt}] | 400, 401, 404, 500 |
| 공개 상품 옵션 및 표시 재고 조회 | GET | /api/v1/products/{id}/options | path id. 수량 점유/차감 없음 | data=배열 [{id,label,selections{},availableQuantity}] | 400, 401, 404, 500 |
| 구매자 본인 상품 문의 및 답변 조회 | GET | /api/v1/products/{id}/inquiries | path id, query page(0~), size(1~100, 기본 20). BUYER JWT 필수(buyerId는 JWT sub) | items[{id,question,answer(null 가능),createdAt,answeredAt,projectedAt}],page,size,totalElements,totalPages,serverTime. 작성 직후 조회모델 미반영 가능 | 400, 401, 403 COMMON_FORBIDDEN, 404, 500 |
| 구매자 상품 문의 등록 | POST | /api/v1/products/{productId}/inquiries | body: question(공백 불가, ≤2000). BUYER. PurchaseGateway(8001) | 201. id,productId,buyerId,version,question,answer(null),createdAt,answeredAt(null) | 400, 401, 403, 404 PRODUCT_NOT_FOUND, 500 |

## 4. 주문·결제

### 주문/결제

공통: 조회(Order Query)=일반 Gateway http://localhost:8000 (직접 8085), BUYER JWT. 쓰기·결제용 원본 조회(Order Command)=PurchaseGateway http://localhost:8001 (직접 8083), BUYER JWT. 계정 ID는 JWT sub, buyerId/sellerId 쿼리·헤더 금지. 목록은 data.content(상품 조회의 data.items와 다름), page 0부터, 빈 결과 content=[] totalElements=0 totalPages=0. 조회 모델은 Kafka 반영 지연 가능 → 결제 직후 Query 미반영/404로 구매 실패 판단 금지, GET /orders/{id}/checkout으로 확인. 오류: 조회=ORDER_QUERY_INVALID_REQUEST(400)/ORDER_QUERY_NOT_FOUND(404, 타인 주문도 404)/COMMON_NOT_ACCEPTABLE(406)/COMMON_FORBIDDEN(403)/COMMON_UNAUTHORIZED(401). 쓰기=ORDER_STATE/ORDER_OWNER/ORDER_INVALID/ORDER_DUPLICATE(409 등)/ORDER_NOT_FOUND(404)/ORDER_UNAVAILABLE(503).

주문 state: RESERVING, HELD, STARTING_PAYMENT, APPROVING_PAYMENT, VERIFYING_PAYMENT, CONFIRMING_STOCK, COMPENSATING_PAYMENT, RELEASING_STOCK, CONFIRMED, FAILED, EXPIRED. delivery: PREPARING, SHIPPING, DELIVERED, null. CONFIRMED에서만 구매 완료로 표시.

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 구매자 본인 주문 목록 조회 | GET | /api/v1/orders | query(모두 선택): keyword(상품명/판매처 ≤100), state, delivery, createdFrom/createdTo(UTC, from 포함·to 미포함), page, size(1~100, 기본 20), productId. 최신 생성순 | content[{orderId,orderNumber,productId,productName,brandOrStore,items[{optionId,label,quantity}],state,delivery,totalAmount,createdAt,sourceVersion,sourceOccurredAt,projectedAt}],page,size,totalElements,totalPages. 배송지·연락처 미포함 | 400 ORDER_QUERY_INVALID_REQUEST, 401, 403, 406, 500 |
| 주문 생성 및 재고 확보 요청 | POST | /api/v1/orders | body: requestKey(UUID, 멱등키), productId(한 주문=한 상품), items[{optionId,quantity≥1}](≥1, optionId 중복 금지), addressId(본인 배송지). PurchaseGateway(8001) | **202 Accepted**(접수, 확정 아님). orderId,orderNumber,version,state,delivery,productId,sellerId,productName,brandOrStore,items,address{recipientName,recipientPhone,postalCode,roadAddress,detailAddress,deliveryMemo},unitPrice,shippingFee,totalAmount,dispatchBusinessDays,expiresAt,serverTime,paymentAttemptId,confirmedAt,carrier,trackingNumber,failureCode,termsVersion. RESERVING이면 상품정보/금액/expiresAt 등 null 가능. HELD에서만 결제 진행, 5분 카운터는 expiresAt·serverTime 기준. 같은 requestKey+동일 본문=기존 주문 반환(기한 연장 없음) | 400 COMMON_INVALID_REQUEST, 401, 403 COMMON_FORBIDDEN, 409 ORDER_STATE/ORDER_DUPLICATE, 500, 503 ORDER_UNAVAILABLE |
| 현재 주문 결제 약관 조회 | GET | /api/v1/orders/checkout-terms | 없음. BUYER, PurchaseGateway | version, title, content, effectiveAt, contentSha256. 결제 요청 시 이 version을 agreed=true와 함께 전송. 하드코딩 금지 | 401, 403, 500, 503 TERMS_UNAVAILABLE |
| 지정 버전 주문 결제 약관 조회 | GET | /api/v1/orders/checkout-terms/{version} | path version(영문/숫자 시작, 영문·숫자·.·_·- , ≤100). BUYER, PurchaseGateway | 위와 동일 필드 | 400 TERMS_INVALID, 401, 403, 404 TERMS_NOT_FOUND, 500, 503 |
| 구매자 전체 주문 문의함 조회 | GET | /api/v1/orders/inquiries | query: productId?, unansweredOnly?(기본 false), page, size(1~100). BUYER, 일반 Gateway(8000). 문의 생성 시각 내림차순 | content[{id,orderId,productId,productName,category,lastMessage,lastMessageAt,awaitingSeller,createdAt,sourceVersion,sourceOccurredAt,projectedAt}],page,size,totalElements,totalPages. awaitingSeller=마지막 메시지가 구매자 작성 | 400, 401, 403, 406, 500 |
| 구매자 본인 주문 상세 조회 | GET | /api/v1/orders/{id} | path id. BUYER, 일반 Gateway(8000) | orderId,orderNumber,productId,productName,brandOrStore,items,state,delivery,address{...},unitPrice,shippingFee,totalAmount,dispatchBusinessDays,expiresAt,createdAt,confirmedAt,carrier,trackingNumber,shippedAt,deliveredAt,sourceVersion,sourceOccurredAt,projectedAt (주문 당시 스냅샷, 미확정 값 null) | 400, 401, 403, 404 ORDER_QUERY_NOT_FOUND, 406, 500 |
| 구매자 결제용 원본 주문 상태 조회 | GET | /api/v1/orders/{id}/checkout | path id. BUYER, PurchaseGateway(8001). 결제 화면 진입·새로고침·결과 확인용(Command 원본) | 주문 생성 응답과 동일 필드(version 포함, serverTime, expiresAt, paymentAttemptId, failureCode, termsVersion). 토스 명확 거절 시 만료 전 FAILED/만료 후 EXPIRED, failureCode=PAYMENT_NOT_COMPLETED(재고 반환→새 주문 유도). 재조회로 만료 연장 없음 | 400, 401, 403, 404 ORDER_NOT_FOUND, 500, 503 |
| 구매자 주문별 문의 목록 조회 | GET | /api/v1/orders/{id}/inquiries | path id, query page, size. BUYER, 일반 Gateway(8000). 생성 시각 내림차순 | content[{id,orderId,category,messages[{seller(false=구매자,true=판매자),body,createdAt}],imageIds[],createdAt,sourceVersion,sourceOccurredAt,projectedAt}],page,size,totalElements,totalPages. 이미지는 Query가 URL 안 줌 → imageIds로 /orders/{order}/inquiry-images/{id}/download(PurchaseGateway) 호출 | 400, 401, 403, 404 ORDER_QUERY_NOT_FOUND, 406, 500 |
| 구매자 주문 문의 상세 조회 | GET | /api/v1/orders/{id}/inquiries/{inquiryId} | path id, inquiryId. BUYER, 8000 | id,orderId,category,messages[],imageIds[],createdAt,sourceVersion,sourceOccurredAt,projectedAt | 400, 401, 403, 404(다른 주문 문의 포함), 406, 500 |
| 주문 결제 승인 처리 요청 | POST | /api/v1/orders/{id}/payment-attempts | path id, body: requestKey(UUID 멱등), paymentKey(토스 결제창 인증 후 값, ≤200), agreed(true), termsVersion(≤100). 금액·buyerId 안 보냄. HELD이고 서버 만료 전만. PurchaseGateway(8001) | **202**. 주문 생성 응답과 동일(state 예: VERIFYING_PAYMENT, paymentAttemptId 채워짐). 202≠결제 성공 → checkout 재조회. 토스 명확 거절/조회 404 NOT_FOUND_PAYMENT면 FAILED(만료 전)/EXPIRED(만료 후)+failureCode PAYMENT_NOT_COMPLETED, 401/409/429/5xx는 결과 불명으로 재확인 | 400 ORDER_INVALID(termsVersion 불일치 시 약관·checkout 재조회), 401, 403, 404 ORDER_NOT_FOUND, 409 ORDER_STATE/ORDER_DUPLICATE, 500, 503 ORDER_UNAVAILABLE |
| 구매자 결제 전 주문 배송지 변경 | PATCH | /api/v1/orders/{id}/shipping-address | path id, body: addressId(UUID), expectedVersion(Long, 직전 checkout version, 명시 전송). HELD + 확보 기한 내만. PurchaseGateway | 200. 주문 생성 응답과 동일 필드(address 갱신) | 400, 401, 403, 404 ORDER_NOT_FOUND, 409 ORDER_STATE, 500, 503 |
| 구매자 주문 문의 등록 | POST | /api/v1/orders/{order}/inquiries | path order, body: requestKey(UUID), category(≤100, 서버 고정 enum 없음), body(≤1000), imageIds[](빈 배열 가능, ≤5, 중복 불가, 업로드 검증 완료한 미연결 이미지). CONFIRMED인 본인 주문만. PurchaseGateway | **200**(명세 표기). id,orderId,version,category,messages[],imageIds[] | 400, 401, 403, 404 ORDER_NOT_FOUND, 409 ORDER_STATE/ORDER_DUPLICATE, 500 |
| 구매자 주문 문의 작성용 원본 조회 | GET | /api/v1/orders/{order}/inquiries/{id}/editing | path order, id. BUYER, PurchaseGateway | id,orderId,version,category,messages[],imageIds[] | 400, 401, 403, 404, 500 |
| 구매자 주문 문의 추가 메시지 등록 | POST | /api/v1/orders/{order}/inquiries/{id}/messages | body: requestKey(UUID), body(≤1000). 편집·첨부 변경 불가. PurchaseGateway | 200. 문의 전체(version 증가, messages 누적) | 400, 401, 403, 404, 409, 500 |
| 구매자 주문 문의 이미지 업로드 권한 발급 | POST | /api/v1/orders/{order}/inquiry-images | path order, body: contentType(image/jpeg·png·webp), sizeBytes(≥1, 기본 ≤10485760). CONFIRMED 주문. 주문당 미사용 업로드 권한 동시 최대 5개. PurchaseGateway | 200. id,url(5분 유효 PUT URL),contentType,sizeBytes,expiresAt. 브라우저가 정확한 Content-Type으로 url에 PUT(Bearer 토큰 S3에 전달 금지) → completion 호출 | 400, 401, 403, 404, 409, 500, 503 |
| 구매자 미연결 주문 문의 이미지 폐기 | DELETE | /api/v1/orders/{order}/inquiry-images/{id} | path order, id. 문의에 연결 전 이미지만 | 200 data=null | 400, 401, 403, 404, 409, 500 |
| 구매자 주문 문의 이미지 업로드 완료 확인 | POST | /api/v1/orders/{order}/inquiry-images/{id}/completion | 본문 없음. S3 PUT 후 호출. 멱등 | 200. id,url(null 정상),contentType,sizeBytes,expiresAt(원래 업로드 권한 기한) | 400, 401, 403, 404, 409, 500, 503 |
| 구매자 주문 문의 이미지 열람 URL 발급 | GET | /api/v1/orders/{order}/inquiry-images/{id}/download | path order, id. 검증 완료 이미지(연결 전도 가능, 폐기본 불가) | id,url(5분 유효 GET),contentType,sizeBytes,expiresAt. 만료 시 재발급 | 400, 401, 403, 404, 500, 503 |
| 토스 결제창 공개 클라이언트 설정 조회 | GET | /api/v1/payments/client-configuration | 없음. BUYER JWT, 일반 Gateway(8000, Payment 직접 8084). SELLER만 가진 토큰은 403, SELLER+BUYER는 접근 가능 | clientKey (토스 SDK 초기화용 공개키). secretKey/paymentKey/결제상태 없음. 흐름: 주문 생성→HELD 확인→이 API→결제창→paymentKey→payment-attempts→checkout 확인 | 401, 403, 406, 500, 503 COMMON_SERVICE_UNAVAILABLE |

## 5. 알림

### 알림

공통: 일반 Gateway http://localhost:8000 (직접 8087). BUYER·SELLER·ADMIN 중 하나 이상 역할의 사용자 JWT. 오류: NOTIFICATION_INVALID_REQUEST(400, 기기 한도 초과 포함), COMMON_UNAUTHORIZED(401), COMMON_FORBIDDEN/NOTIFICATION_FORBIDDEN(403), COMMON_NOT_ACCEPTABLE(406).

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 본인 알림함 목록 조회 | GET | /api/v1/notifications | query page(0~), size(1~100, 기본 20). 최신순. 조회해도 읽음 상태 안 바뀜 | content[{id,type,title,body,targetType,targetId,relatedId,deadline,occurredAt,createdAt,readAt(null=안 읽음)}],page,size,totalElements (**totalPages 없음**). targetType: PRODUCT/SELLER_APPLICATION/SELLER_PRODUCT/SELLER_PRODUCT_REVISION(targetId=productId, relatedId=revisionId)/ORDER/SELLER_ORDER. 프론트가 대상으로 라우트 결정. type 예 PERSONALIZED_PRODUCT | 400, 401, 403, 406, 500 |
| 웹 푸시 활성 상태 및 공개 VAPID 키 조회 | GET | /api/v1/notifications/push-configuration | 없음. 사용자 JWT 필요(공개 아님) | enabled, publicKey(enabled=false면 null, 200). iPhone 홈 화면 PWA 대상(HTTPS+manifest+Service Worker, 사용자 동작 안에서 권한 요청) | 401, 403, 406, 500 |
| 본인 기기 웹 푸시 구독 목록 조회 | GET | /api/v1/notifications/push-subscriptions | 없음 | data=배열 [{id,active,expiresAt,createdAt}] 생성 내림차순. 비활성 포함 가능. endpoint/키 미반환, 기기명 필드 없음 | 401, 403, 406, 500 |
| 본인 브라우저 웹 푸시 구독 등록 및 갱신 | POST | /api/v1/notifications/push-subscriptions | body: endpoint(≤4096, https://web.push.apple.com 호스트만, 포트 생략/443), expirationTime?(epoch ms, 미래), keys{p256dh(Base64URL, 디코딩 65바이트 0x04), auth(Base64URL, 디코딩 16바이트)}. subscription.toJSON() 형식. 계정당 활성 20개 한도. 순서: push-configuration→권한→PushManager.subscribe→POST | 200. id,active,expiresAt,createdAt. 같은 계정+endpoint 동일 요청은 기존 반환, 다른 계정 소유 endpoint는 403 | 400 NOTIFICATION_INVALID_REQUEST(형식/한도 초과), 401, 403 NOTIFICATION_FORBIDDEN, 406, 500, 503 NOTIFICATION_UNAVAILABLE |
| 본인 기기 웹 푸시 구독 해제 | DELETE | /api/v1/notifications/push-subscriptions/{id} | path id(서버 구독 ID). 로그아웃 전에 호출 후 브라우저 unsubscribe | 200 data=null. 이미 비활성 재요청도 성공. 물리 삭제 아님 | 400, 401, 403 NOTIFICATION_FORBIDDEN, 404 NOTIFICATION_NOT_FOUND, 406, 500 |
| 본인 알림 전체 읽음 처리 | PATCH | /api/v1/notifications/read-all | 없음 | changed(실제 변경 건수, 없으면 0) | 401, 403, 406, 500 |
| 본인 안 읽은 알림 개수 조회 | GET | /api/v1/notifications/unread-count | 없음. 읽음 상태 변경 없음 | count | 401, 403, 406, 500 |
| 본인 알림 상세 및 이동 대상 조회 | GET | /api/v1/notifications/{id} | path id. 읽음 처리 안 함. 푸시 클릭은 동일 origin /?notificationId=UUID로 진입→로그인 확인→이 API | 알림 항목과 동일 필드(id,type,title,body,targetType,targetId,relatedId,deadline,occurredAt,createdAt,readAt) | 400, 401, 403 NOTIFICATION_FORBIDDEN, 404 NOTIFICATION_NOT_FOUND, 406, 500 |
| 본인 알림 단건 읽음 처리 | PATCH | /api/v1/notifications/{id}/read | path id | changed(처음 1, 이미 읽음 0). 최초 readAt 유지. 알림 상세 아님 | 400, 401, 403, 404, 406, 500 |

## 6. 판매자 입점 신청(구매자 측)

### 판매자 입점 신청 (구매자 측, Account 서비스)

공통: BUYER 권한 활성 인증 완료 계정의 Access JWT. 403 SELLER_BUYER_REQUIRED, 404 SELLER_APPLICATION_NOT_FOUND. 응답 신청 객체 SellerApplication = {applicationId,accountId,attemptNumber,sellerDisplayName,contactName,contactEmail,contactPhone,bankName,maskedBankAccount("********9012"),dispatchAddress{postalCode,roadAddress,detailAddress},returnAddress{...},status("PENDING" 등; CHANGES_REQUESTED 존재),submittedAt,reviewedAt,reviewedBy,rejectionReason,certificateReviewed,certificateRecheck,previousApplicationId}. 사업자 정보(상호·대표자·등록번호 등) 필드는 응답에 없음.

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 판매자 입점 신청 | POST | /api/v1/seller-applications | **multipart/form-data**. 파트 application(JSON, Content-Type application/json): sellerDisplayName?(≤100), contactName(≤100), contactEmail(≤320), contactPhone, bankName(≤50), bankAccountNumber(하이픈 제거 후 숫자 6~30), dispatchAddress{postalCode(5자리),roadAddress(≤200),detailAddress?(≤200)}, returnAddress{동일}. 파트 certificate: 사업자등록증 PDF 1개(≤5MiB). 심사 중 중복 제출 불가 | 201. applicationId, status("PENDING"). Location 헤더 | 400 COMMON_INVALID_REQUEST / SELLER_CERTIFICATE_REQUIRED / SELLER_INVALID_CERTIFICATE, 401, 403 SELLER_BUYER_REQUIRED, 409 SELLER_ALREADY_APPLIED, 413 SELLER_CERTIFICATE_TOO_LARGE, 503 SELLER_CERTIFICATE_UNAVAILABLE |
| 내 최신 판매자 신청 조회 | GET | /api/v1/seller-applications/me | 없음 | SellerApplication | 400, 401, 403, 500 |
| 내 판매자 신청 이력 조회 | GET | /api/v1/seller-applications/me/history | 없음 | data=배열 SellerApplication[] (없으면 []) | 400, 401, 403, 500 |
| 내 판매자 신청 단건 조회 | GET | /api/v1/seller-applications/{applicationId} | path | SellerApplication | 400, 401, 403, 404, 500 |
| 내 사업자등록증 PDF 조회 | GET | /api/v1/seller-applications/{applicationId}/certificate | path | **JSON 아님**. PDF 바이너리(application/pdf, attachment; filename="business-registration.pdf", no-store). 실패 시 오류 JSON | 400, 401, 403, 404, 503 SELLER_CERTIFICATE_UNAVAILABLE |
| 내 판매자 신청 보완 요청 조회 | GET | /api/v1/seller-applications/{id}/correction-request | path id | id,applicationId,deadline(UTC),state("OPEN" 등),items[{field(CERTIFICATE/STORE_NAME/CONTACT/BANK_ACCOUNT/DISPATCH_ADDRESS/RETURN_ADDRESS),reason}],submittedApplicationId | 400, 401, 403, 404, 500 |
| 판매자 신청 보완 제출 | POST | /api/v1/seller-applications/{id}/resubmissions | multipart. 파트 application(JSON): contact{name(≤100),email(≤320),phone}(조건부), 파트 certificate(PDF, 서류 보완 요청 시 필수). 최신 CHANGES_REQUESTED의 OPEN 보완 요청, 기한 내, 운영자가 요청한 항목만 | 201. applicationId, status("PENDING"). 이전 신청 연결 새 회차 생성 | 400 SELLER_INVALID_REVIEW_REQUEST / SELLER_CERTIFICATE_REQUIRED / SELLER_INVALID_CERTIFICATE, 401, 403, 404, 409 SELLER_CORRECTION_EXPIRED(새 신청으로), 413, 503 |

## 7. 판매자 주문·배송·문의

### 판매자 주문/배송/문의

공통: 조회(Order Query)=일반 Gateway 8000(직접 8085) SELLER JWT. 쓰기·원본조회(Order Command)=PurchaseGateway 8001(직접 8083) SELLER JWT. 오류코드는 구매자 주문과 동일(ORDER_QUERY_*, ORDER_*).

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 판매자 본인 주문 목록 조회 | GET | /api/v1/seller/orders | query는 구매자 주문 목록과 동일(keyword,state,delivery,createdFrom,createdTo,page,size,productId) | content[{orderId,orderNumber,productId,productName,brandOrStore,items[],state,delivery,totalAmount,createdAt,sourceVersion,sourceOccurredAt,projectedAt}],page,size,totalElements,totalPages | 400 ORDER_QUERY_INVALID_REQUEST, 401, 403, 406, 500 |
| 판매자 전체 주문 문의함 조회 | GET | /api/v1/seller/orders/inquiries | query productId?, unansweredOnly?(기본 false), page, size | content[{id,orderId,productId,productName,category,lastMessage,lastMessageAt,awaitingSeller,createdAt,sourceVersion,sourceOccurredAt,projectedAt}],page,size,totalElements,totalPages | 400, 401, 403, 406, 500 |
| 판매자 주문 및 배송 상태 집계 조회 | GET | /api/v1/seller/orders/summary | query productId?, createdFrom?, createdTo? | totalOrders, confirmedOrders, preparingOrders, shippingOrders, deliveredOrders, confirmedQuantity, approximate(true). 매출·수수료·정산 금액 계산 안 함 | 400, 401, 403, 406, 500 |
| 판매자 본인 주문 상세 조회 | GET | /api/v1/seller/orders/{id} | path id | 구매자 주문 상세와 동일 필드(orderId..address{recipientName,recipientPhone,postalCode,roadAddress,detailAddress,deliveryMemo}..carrier,trackingNumber,shippedAt,deliveredAt,sourceVersion..). 변경 작업의 version으로 sourceVersion 사용 금지 → fulfillment 재조회 | 400, 401, 403, 404 ORDER_QUERY_NOT_FOUND, 406, 500 |
| 판매자 수동 배송 완료 처리 | POST | /api/v1/seller/orders/{id}/delivery-completion | path id, body: expectedVersion(Long, 직전 fulfillment version). CONFIRMED+SHIPPING만. PurchaseGateway | 200. 주문 응답(delivery="DELIVERED", version+1, carrier, trackingNumber…). 이미 DELIVERED면 멱등 | 400, 401, 403, 404 ORDER_NOT_FOUND, 409 ORDER_STATE, 500, 503 |
| 판매자 출고 작업용 원본 주문 조회 | GET | /api/v1/seller/orders/{id}/fulfillment | path id. PurchaseGateway(Command 원본) | 주문 응답 필드(version, state, delivery, address, carrier(null), trackingNumber(null) …). 이 version을 shipment/delivery-completion에 전달 | 400, 401, 403, 404, 500, 503 |
| 판매자 주문별 문의 목록 조회 | GET | /api/v1/seller/orders/{id}/inquiries | path id, query page, size. SELLER, 8000 | content[{id,orderId,category,messages[{seller,body,createdAt}],imageIds[],createdAt,sourceVersion,sourceOccurredAt,projectedAt}],page,size,totalElements,totalPages. 이미지는 /seller/orders/{order}/inquiry-images/{id}/download(PurchaseGateway)로 URL 발급 | 400, 401, 403, 404, 406, 500 |
| 판매자 주문 문의 상세 조회 | GET | /api/v1/seller/orders/{id}/inquiries/{inquiryId} | path id, inquiryId | 문의 1건(위와 동일 필드) | 400, 401, 403, 404, 406, 500 |
| 판매자 송장 등록 및 배송 시작 | POST | /api/v1/seller/orders/{id}/shipment | body: carrier(공백 불가 ≤100), trackingNumber(영문·숫자·하이픈 1~100), expectedVersion(직전 fulfillment version). CONFIRMED+PREPARING만. 배송 중 정정 불가. 같은 택배사+송장 재요청은 멱등. PurchaseGateway | 200. 주문 응답(delivery="SHIPPING", version+1, carrier, trackingNumber) | 400, 401, 403, 404, 409 ORDER_STATE, 500, 503 |
| 판매자 주문 문의 답변 등록 | POST | /api/v1/seller/orders/{order}/inquiries/{id}/answers | path order, id, body: requestKey(UUID), body(≤1000). PurchaseGateway | 200. 문의 원본(id,orderId,version,category,messages[{seller:true,...}],imageIds[]). 상품 FAQ로 자동 공개 안 됨 | 400, 401, 403, 404, 409, 500 |
| 판매자 주문 문의 답변용 원본 조회 | GET | /api/v1/seller/orders/{order}/inquiries/{id}/editing | path order, id. PurchaseGateway | id,orderId,version,category,messages[],imageIds[] | 400, 401, 403, 404, 500 |
| 판매자 주문 문의 이미지 열람 URL 발급 | GET | /api/v1/seller/orders/{order}/inquiry-images/{id}/download | path order, id. 문의에 실제 연결된 검증 사진만(미연결은 비공개). PurchaseGateway | id,url(5분 GET),contentType,sizeBytes,expiresAt | 400, 401, 403, 404, 500, 503 |

## 8. 판매자 상품 관리·등록

### 판매자 상품 관리·등록 (Product Command)

공통: SELLER JWT(+최신 Account 판매자 자격). PurchaseGateway http://localhost:8001 (직접 8081). 오류 COMMON_INVALID_REQUEST/COMMON_UNAUTHORIZED/COMMON_FORBIDDEN/PRODUCT_NOT_OWNER(소유권)/PRODUCT_INVALID(상품·옵션 구성)/PRODUCT_NOT_FOUND(404)/PRODUCT_STATE(409)/PRODUCT_POLICY(503)/500. 변경 성공=로컬 DB 트랜잭션 완료(Query 화면 동기화 아님). version은 낙관적 잠금: 직전 조회 결과로 교체.

SellerProduct(편집 원본) = ProductReview와 동일 구조 {id,sellerId,version,status(DRAFT/IN_REVIEW/REJECTED/APPROVED),name,description,sourceUrl,category,price,shippingFee,dispatchBusinessDays,perAccountLimit,shippingNotice,purchaseNotice,disposalReason,startsAt,endsAt,reviewReason,options[{id,label,initialQuantity,reservedQuantity,confirmedQuantity,availableQuantity,selections{}}],brandOrStore,attributes[{name,value}],optionDimensions[{name,values[]}],dispatchAddress,returnAddress,addressesCapturedAt,faqs[]}

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 판매자 본인 상품 관리 목록 조회 | GET | /api/v1/seller/products | query: status?(DRAFT/IN_REVIEW/REJECTED/APPROVED), month?(yyyy-MM, KST 판매 시작 월), saleState?(SCHEDULED/ON_SALE/ENDED), page, size(1~100, 기본 20) | items[{id,name,status,version,startsAt,endsAt,createdAt,updatedAt,submittedAt}],page,size,totalElements,totalPages | 400, 401, 403, 500, 503 |
| 상품 등록 초안 생성 | POST | /api/v1/seller/products | 본문 없음 | 201. SellerProduct(status DRAFT, version 0, 나머지 null/빈 배열) | 401, 403, 409 PRODUCT_STATE, 500, 503 |
| 판매자 본인 상품 문의함 조회 | GET | /api/v1/seller/products/inquiries | query productId?, unanswered?(기본 false), page, size(1~100) | items[{id,productId,buyerId,version,question,answer,createdAt,answeredAt}],page,size,totalElements,totalPages | 400, 401, 403 PRODUCT_NOT_OWNER, 500, 503 |
| 상품 등록 카테고리 및 AI 점검 기준 조회 | GET | /api/v1/seller/products/registration-metadata | 없음 | categories[string 이름](초기 데이터 255개 분류), categoryCriteria[{code("CLOTHING"),name("의류"),checks[{code("CLOTHING_MEASUREMENTS"),question}]}] | 401, 403, 500, 503 |
| 판매자 상품 판매 및 재고 집계 조회 | GET | /api/v1/seller/products/sales-summary | query month?(yyyy-MM) | productCount, scheduledCount, onSaleCount, endedCount, initialQuantity, reservedQuantity, confirmedQuantity, availableQuantity. 매출·수수료·정산 미계산 | 400, 401, 403, 500, 503 |
| 판매자 본인 상품 편집 정보 조회 | GET | /api/v1/seller/products/{id} | path id | SellerProduct (version 포함) | 400, 401, 403, 404, 500, 503 |
| 상품 AI 카테고리 및 등록 정보 점검 요청 | POST | /api/v1/seller/products/{id}/ai-analyses | path id, body: expectedVersion. 현재 이미지·기본정보·처분 사유 기준 | **202**. requestId, productId, fingerprint, completed(같은 입력의 기존 완료 분석이면 true). 이후 GET /api/v1/ai/product-analyses/{requestId}(일반 Gateway 8000) 폴링 | 400, 401, 403, 404, 409 PRODUCT_STATE, 500, 503 |
| 검증 FAQ 개별 추가 | POST | /api/v1/seller/products/{id}/faqs | body: expectedVersion, faq{id?(기존 항목 ID, 미지정=신규), question(≤2000), answer(≤8000), confirmed(저장하려면 true), suggestionId?(AI 제안 질문 ID, 현재 분석 결과와 일치해야 함)} | 200. **SellerProduct 전체**(faqs[{id,question,answer,suggestionId,sourceInquiryId,confirmedBy,confirmedAt}]) | 400, 401, 403, 404, 409, 500, 503 |
| 검증 FAQ 개별 삭제 | DELETE | /api/v1/seller/products/{id}/faqs/{faqId} | path id, faqId, **query expectedVersion** | 200(204 아님). 삭제 후 SellerProduct 전체 | 400, 401, 403, 404, 409, 500, 503 |
| 검증 FAQ 개별 수정 | PUT | /api/v1/seller/products/{id}/faqs/{faqId} | path id, faqId(수정 대상 식별), body는 추가와 동일 | 200. SellerProduct 전체 | 400, 401, 403, 404, 409, 500, 503 |
| 상품 등록 1단계, 기본 정보 저장 | PUT | /api/v1/seller/products/{id}/registration/basic-info | body: expectedVersion, name?(≤200), description?(≤20000), brandOrStore?(≤200), category?(registration-metadata의 categories 이름, categoryCriteria.code와 혼동 금지, ≤200), sourceUrl?(http/https ≤2000). DRAFT/REJECTED만. 해당 단계 값 전체 교체(생략한 nullable은 비워짐) | 200. SellerProduct(version 갱신) → 다음 요청에 이 version 사용 | 400, 401, 403, 404, 409, 500, 503 |
| 상품 등록 2단계, 상세 속성 및 처분 사유 저장 | PUT | /api/v1/seller/products/{id}/registration/details | body: expectedVersion, attributes[{name(≤200),value(≤4000)}](필수), disposalReason?(≤4000, 최종 심사 제출 시 필수) | 200. SellerProduct | 400, 401, 403, 404, 409, 500, 503 |
| 상품 등록 6단계, 검증 FAQ 전체 저장 | PUT | /api/v1/seller/products/{id}/registration/faqs | body: expectedVersion, faqs[{id?,question(≤2000),answer(≤8000),confirmed(true만 저장),suggestionId?}] (빈 배열=전체 제거). DRAFT/REJECTED만 | 200. SellerProduct | 400, 401, 403, 404, 409, 500, 503 |
| 상품 등록 3단계, 옵션 및 최초 재고 저장 | PUT | /api/v1/seller/products/{id}/registration/options | body: expectedVersion, dimensions[{name(공백·중복 불가 ≤200),values[](공백·중복 불가, ≥1)}](색상/사이즈로 고정 안 함), variants[{id?,selections{차원명:값},initialQuantity(≥1)}]. 차원과 선택값 일치, 중복 조합 거부, 이미 확보/확정된 수량 임의 변경 불가. 옵션별 추가 가격 없음 | 200. SellerProduct(options[{id,label,initialQuantity,...,selections}]) | 400 PRODUCT_INVALID, 401, 403, 404, 409, 500, 503 |
| 상품 등록 4단계, 가격 및 배송 저장 | PUT | /api/v1/seller/products/{id}/registration/pricing-shipping | body: expectedVersion, price?(Long ≥1, 전 옵션 공통 단가), shippingFee?(Long ≥0), dispatchBusinessDays?(≥1), perAccountLimit?(≥1), shippingNotice?(≤4000), purchaseNotice?(≤4000), dispatchAddressId?(Account 출고지 ID, 생략=기본), returnAddressId?(생략=기본). 주소 스냅샷 보관 | 200. SellerProduct | 400, 401, 403, 404, 409, 500, 503 |
| 상품 등록 5단계, 판매 일정 저장 | PUT | /api/v1/seller/products/{id}/registration/schedule | body: expectedVersion, startsAt?(OffsetDateTime, 미래, null이면 일정 삭제). 종료=시작+3시간(서버 계산). 심사 제출 전 미래 일정 필요 | 200. SellerProduct(startsAt, endsAt) | 400, 401, 403, 404, 409, 500, 503 |
| 상품 최초 심사 제출 | POST | /api/v1/seller/products/{id}/review-submissions | body: expectedVersion. DRAFT/REJECTED 대상. 필요: 상품명, 설명, sourceUrl, 유효 카테고리, 가격, 배송비, 출고 기한, 구매 제한, 처분 사유, 옵션, 출고지·반품지, 미래 판매 시작, 완료된 이미지 | 200. SellerProduct(status IN_REVIEW). 운영자 승인 전 비공개 | 400 PRODUCT_INVALID, 401, 403, 404, 409, 500, 503 |
| 판매자 상품 수정 심사 이력 조회 | GET | /api/v1/seller/products/{id}/revisions | path id | **data=배열**(page 없음) ProductRevision[] {id,productId,version,status,changes{...},shipping{...},submittedAt,reviewedAt,reason} | 400, 401, 403, 404, 500, 503 |
| 승인 상품 수정 심사 제출 | POST | /api/v1/seller/products/{id}/revisions | body: expectedVersion(**원본 상품 version**), name(≤200), description(≤20000), imageIds[](완료된 본인 이미지, 순서=표시 순서, 1~10), representativeId(imageIds 중), shippingFee(≥0), dispatchBusinessDays(≥1), shippingNotice?(≤4000), purchaseNotice?(≤4000), startsAt(OffsetDateTime 미래), dispatchAddressId?, returnAddressId?. APPROVED 상품의 판매 시작 전만, 진행 중 회차 1개만. 가격·옵션·최초 수량은 수정 대상 아님 | 201. ProductRevision(status IN_REVIEW, version 0) | 400, 401, 403, 404, 409, 500, 503 |
| 상품 이미지 직접 업로드 권한 발급 | POST | /api/v1/seller/products/{productId}/image-uploads | body: contentType(image/jpeg·png·webp), sizeBytes(1~10MiB). 상품 첨부 최대 10개. PurchaseGateway | 200. imageId, uploadUrl(5분 PUT URL), contentType, sizeBytes, expiresAt. 동일 Content-Type·바이너리로 uploadUrl에 PUT(Bearer 토큰 S3에 전달 금지) → completion | 400, 401, 403, 404, 409, 500, 503 |
| 상품 편집용 이미지 목록 조회 | GET | /api/v1/seller/products/{productId}/images | path | data=배열 [{id,objectKey,contentType,sizeBytes,position,representative}] | 400, 401, 403, 404, 500, 503 |
| 상품 이미지 순서 및 대표 이미지 변경 | PUT | /api/v1/seller/products/{productId}/images | body: imageIds[](완료된 본인 이미지, 순서=표시 순서, ≥1), representativeId(imageIds 안) | data=이미지 배열(위와 동일) | 400, 401, 403, 404, 409, 500, 503 |
| 상품 이미지 연결 해제 | DELETE | /api/v1/seller/products/{productId}/images/{imageId} | path | 200 data=null | 400, 401, 403, 404, 409, 500, 503 |
| 상품 이미지 업로드 완료 확인 | POST | /api/v1/seller/products/{productId}/images/{imageId}/completion | 본문 없음. S3 PUT 후. 멱등. 승인 상품의 신규 업로드는 수정 심사 후보(즉시 공개 이미지 변경 안 함) | 200. 이미지 항목 {id,objectKey,contentType,sizeBytes,position,representative} | 400, 401, 403, 404, 409, 500, 503 |
| 판매자 상품 이미지 열람 URL 발급 | GET | /api/v1/seller/products/{productId}/images/{imageId}/download-url | path | downloadUrl, expiresAt(5분) | 400, 401, 403, 404, 500, 503 |
| 상품 문의 답변 작성 및 수정 | PUT | /api/v1/seller/products/{productId}/inquiries/{inquiryId}/answer | body: expectedVersion(**문의 version**), answer(≤8000), publishToFaq?(기본 false, true면 FAQ도 갱신). 심사 중에는 답변 불가 | 200. {id,productId,buyerId,version,question,answer,createdAt,answeredAt} | 400, 401, 403, 404, 409, 500, 503 |

## 9. 판매자 마이페이지·주소록·스토어

### 판매자 마이페이지 / 주소록 / 스토어 (Account 서비스)

공통: SELLER Access JWT. 403 SELLER_APPROVAL_REQUIRED(승인된 판매자 필요), SELLER_SALES_RESTRICTED(사업자등록증 재심사 중 판매자 변경 업무 제한). 404 SELLER_ADDRESS_NOT_FOUND. 오류 형식 공통.

SellerAddress = {id,type("DISPATCH"|"RETURN"),label,contactName,contactPhone,address{postalCode,roadAddress,detailAddress},defaultAddress}. type 경로값은 DISPATCH(출고지) 또는 RETURN(반품지). 기본 주소 변경은 판매자 프로필에 동기화.

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 내 판매자 마이페이지 정보 조회 | GET | /api/v1/sellers/me | 없음 | accountId, approvedApplicationId, sellerDisplayName, contactName, contactEmail, contactPhone, bankAccount{bankName,maskedBankAccount,accountHolderName(null 가능)}, dispatchAddress{postalCode,roadAddress,detailAddress}, returnAddress{...}, approvedAt, updatedAt. (사업자 상호·대표자·등록번호 필드 없음) | 400, 401, 403 SELLER_APPROVAL_REQUIRED / SELLER_SALES_RESTRICTED, 500 |
| 판매자 주소록 목록 조회 | GET | /api/v1/sellers/me/address-book/{type} | path type | data=배열 SellerAddress[] (없으면 []) | 400, 401, 403, 500 |
| 판매자 주소록 등록 | POST | /api/v1/sellers/me/address-book/{type} | path type, body: label(≤50), contactName(≤100), contactPhone, address{postalCode(5자리),roadAddress(≤200),detailAddress?(≤200)} | 201. SellerAddress | 400, 401, 403, 500 |
| 판매자 주소록 삭제 | DELETE | /api/v1/sellers/me/address-book/{type}/{id} | path type, id | data=null | 400, 401, 403, 404 SELLER_ADDRESS_NOT_FOUND, 409 SELLER_DEFAULT_ADDRESS_REQUIRED(기본 주소는 다른 주소를 기본으로 지정 후 삭제) |
| 판매자 주소록 단건 조회 | GET | /api/v1/sellers/me/address-book/{type}/{id} | path type, id | SellerAddress | 400, 401, 403, 404 |
| 판매자 주소록 단건 수정 | PUT | /api/v1/sellers/me/address-book/{type}/{id} | path + body는 등록과 동일 | SellerAddress | 400, 401, 403, 404 |
| 판매자 기본 출고지 또는 반품지 지정 | PUT | /api/v1/sellers/me/address-book/{type}/{id}/default | path type, id. 본문 없음 | data=null | 400, 401, 403, 404 |
| 내 판매자 출고와 반품 주소 수정 | PUT | /api/v1/sellers/me/addresses | body: dispatchAddress{postalCode,roadAddress,detailAddress?}, returnAddress{...} 둘 다 필수. 기존 호환 API(출고지·반품지 동시 변경, 새 주소록 기본 주소와 동기화) | data=null | 400, 401, 403, 500 |
| 내 판매자 정산 계좌 수정 | PUT | /api/v1/sellers/me/bank-account | body: bankName(≤50), bankAccountNumber(하이픈 제거 후 숫자 6~30), accountHolderName(≤100) 모두 필수. 암호화 저장, 실존·실명 검증·송금 안 함 | data=null | 400, 401, 403, 500 |
| 판매자 사업자등록증 재심사 신청 | POST | /api/v1/sellers/me/certificate-reviews | **multipart**: certificate(PDF 1개 ≤5MiB). **BUYER 권한 JWT**(기존 판매자 프로필 있는 계정). 심사 중 중복 불가, 재심사 중 판매자 변경 업무 제한 | 201. applicationId, status("PENDING") | 400 SELLER_CERTIFICATE_REQUIRED / SELLER_INVALID_CERTIFICATE, 401, 403 SELLER_BUYER_REQUIRED, 409 SELLER_ALREADY_APPLIED, 413 SELLER_CERTIFICATE_TOO_LARGE, 503 |
| 내 판매자 표시 이름과 담당자 정보 수정 | PUT | /api/v1/sellers/me/contact | body: sellerDisplayName?(≤100), contactName(≤100), contactEmail(≤320), contactPhone. 회원 이름·이메일은 안 바뀜 | data=null | 400, 401, 403, 500 |
| 내 판매자 재심사 상태 조회 | GET | /api/v1/sellers/me/review-status | 없음. **BUYER 권한 JWT**(판매 제한 중에도 조회 가능) | salesRestricted(bool), application(SellerApplication), correction(보완 요청 객체 또는 null) | 400, 401, 403 SELLER_BUYER_REQUIRED, 500 |
| 내 스토어 설정 조회 | GET | /api/v1/sellers/me/store | 없음 | sellerDisplayName, introduction, hasLogo, updatedAt | 400, 401, 403, 500 |
| 내 스토어 소개 수정 | PUT | /api/v1/sellers/me/store | body: introduction(필수, 공백 제거 후 ≤40자, 빈 문자열 허용) | sellerDisplayName, introduction, hasLogo, updatedAt | 400, 401, 403, 500 |
| 내 스토어 로고 삭제 | DELETE | /api/v1/sellers/me/store/logo | 없음 | data=null | 400, 401, 403, 500 |
| 내 스토어 로고 이미지 조회 | GET | /api/v1/sellers/me/store/logo | 없음 | **JSON 아님**. 이미지 바이너리(image/png 또는 image/jpeg, no-store). 객체 키 비노출 | 400, 401, 403, 404 SELLER_LOGO_NOT_FOUND, 503 SELLER_LOGO_UNAVAILABLE |
| 내 스토어 로고 등록 또는 교체 | POST | /api/v1/sellers/me/store/logo | **multipart**: image(JPEG/PNG 1개, ≤2MiB, 가로·세로 ≤4096) | 200. 스토어 설정(sellerDisplayName, introduction, hasLogo=true, updatedAt) | 400 SELLER_INVALID_LOGO, 401, 403, 503 SELLER_LOGO_UNAVAILABLE |

## 10. 운영자

### 운영자(admin) - 판매자 입점 심사 (Account 서비스)

공통: ADMIN Access JWT. 403 SELLER_ADMIN_REQUIRED. 404 SELLER_APPLICATION_NOT_FOUND. 신청 객체는 SellerApplication(판매자 입점 신청 절 참고).

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 운영자 판매자 신청 목록 | GET | /api/v1/admin/seller-applications | query: status?(PENDING/APPROVED/REJECTED/CHANGES_REQUESTED/EXPIRED, 생략=전체), page(0~), size(1~100, 기본 20) | content[SellerApplication],page,size,totalElements,totalPages | 400, 401, 403 |
| 운영자 판매자 신청 상세 | GET | /api/v1/admin/seller-applications/{applicationId} | path | SellerApplication | 400, 401, 403, 404 |
| 판매자 신청 승인 | POST | /api/v1/admin/seller-applications/{applicationId}/approve | 본문 없음. 현재 운영자가 해당 PDF를 먼저 열람(certificate-review)해야 승인 가능. BUYER 유지+SELLER 추가. 승인 직후 기존 JWT roles 미갱신 → 대상자는 Access Token 재발급 필요 | data=null | 401, 403, 404, 409 SELLER_ALREADY_REVIEWED / SELLER_CERTIFICATE_REVIEW_REQUIRED |
| 운영자 PDF 열람 및 기록 | POST | /api/v1/admin/seller-applications/{applicationId}/certificate-review | 본문 없음 | **PDF 바이너리**(application/pdf, attachment). 열람 기록 남김 | 400, 401, 403, 404, 503 SELLER_CERTIFICATE_UNAVAILABLE |
| 판매자 신청 거절 | POST | /api/v1/admin/seller-applications/{applicationId}/reject | body: reason(공백 불가, ≤1000) | data=null | 400, 401, 403, 404, 409 SELLER_ALREADY_REVIEWED |
| 운영자 판매자 신청 보완 요청 조회 | GET | /api/v1/admin/seller-applications/{id}/correction-request | path id | id,applicationId,deadline,state("OPEN"),items[{field,reason}],submittedApplicationId | 400, 401, 403, 404 |
| 운영자 판매자 신청 보완 요청 | POST | /api/v1/admin/seller-applications/{id}/correction-request | body: deadline(미래, ISO UTC), items[{field(CERTIFICATE/STORE_NAME/CONTACT/BANK_ACCOUNT/DISPATCH_ADDRESS/RETURN_ADDRESS), reason(≤500)}] (1~6개, field 중복 불가) | 보완 요청 객체(위와 동일) | 400 COMMON_INVALID_REQUEST / SELLER_INVALID_REVIEW_REQUEST, 401, 403, 404 |

### 운영자(admin) - 상품 심사 (Product Command)

공통: ADMIN JWT, PurchaseGateway http://localhost:8001 (직접 8081). 오류 COMMON_INVALID_REQUEST(400)/COMMON_UNAUTHORIZED/COMMON_FORBIDDEN/PRODUCT_NOT_FOUND(404)/PRODUCT_STATE(409, 버전 불일치·상태 충돌)/PRODUCT_POLICY(503)/500.

ProductReview(최초 심사 원본) = {id,sellerId,version,status,name,description,sourceUrl,category,price,shippingFee,dispatchBusinessDays,perAccountLimit,shippingNotice,purchaseNotice,disposalReason,startsAt,endsAt,reviewReason,options[{id,label,initialQuantity,reservedQuantity,confirmedQuantity,availableQuantity,selections{}}],brandOrStore,attributes[{name,value}],optionDimensions[{name,values[]}],dispatchAddress{postalCode,roadAddress,detailAddress},returnAddress{...},addressesCapturedAt,faqs[]}

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 운영자 최초 상품 심사 목록 조회 | GET | /api/v1/admin/product-reviews | query status(DRAFT/IN_REVIEW/REJECTED/APPROVED, 기본 IN_REVIEW), page(0~), size(1~100, 기본 20) | items[{id,name,status,version,startsAt,endsAt,createdAt,updatedAt,submittedAt}],page,size,totalElements,totalPages | 400, 401, 403, 500 |
| 운영자 상품 수정 심사 목록 조회 | GET | /api/v1/admin/product-reviews/revisions | query status(IN_REVIEW/APPROVED/REJECTED, 기본 IN_REVIEW), page, size | **data=배열(페이징 메타 없음)** [{id,productId,version,status,changes{expectedVersion,name,description,imageIds[],representativeId,shippingFee,dispatchBusinessDays,shippingNotice,purchaseNotice,startsAt,dispatchAddressId,returnAddressId},shipping{accountId,dispatchAddress,returnAddress},submittedAt,reviewedAt,reason}] | 400, 401, 403, 500 |
| 운영자 최초 상품 심사 상세 조회 | GET | /api/v1/admin/product-reviews/{id} | path id(상품 ID) | ProductReview | 400, 401, 403, 404 PRODUCT_NOT_FOUND, 500 |
| 운영자 상품 최초 심사 승인 및 반려 | POST | /api/v1/admin/product-reviews/{id}/decisions | body: expectedVersion(Long, 조회 응답 version, 불일치 409), approved?(생략=false), reason?(approved=false면 필수, ≤2000). IN_REVIEW만. 최초 승인은 서버 판매 시작 시각 이전에만 가능 | ProductReview(status APPROVED/REJECTED, version 갱신). 공개 Query 화면은 이벤트 반영까지 지연 | 400, 401, 403, 404, 409 PRODUCT_STATE, 500 |
| 운영자 상품 심사용 이미지 목록 조회 | GET | /api/v1/admin/product-reviews/{id}/images | path id | data=배열 [{id,objectKey,contentType,sizeBytes,position,representative}] | 400, 401, 403, 404, 500 |
| 운영자 상품 심사용 이미지 열람 URL 발급 | GET | /api/v1/admin/product-reviews/{id}/images/{imageId}/download-url | path id, imageId | downloadUrl(임시), expiresAt(5분) | 400, 401, 403, 404, 500, 503 PRODUCT_POLICY |
| 운영자 상품 수정 심사 상세 조회 | GET | /api/v1/admin/product-reviews/{productId}/revisions/{revisionId} | path productId, revisionId | ProductRevision {id,productId,version,status,changes{...},shipping{...},submittedAt,reviewedAt,reason} (목록 항목과 동일) | 400, 401, 403, 404, 500 |
| 운영자 상품 수정 심사 승인 및 반려 | POST | /api/v1/admin/product-reviews/{productId}/revisions/{revisionId}/decisions | body: expectedVersion(**수정 심사 회차 version**, 상품 version 아님), approved?(생략=false), reason?(반려 시 필수 ≤2000). 승인 시 스냅샷을 원본에 적용, 원래 판매 시작 후 승인 거부 | ProductRevision(status 갱신, reviewedAt) | 400, 401, 403, 404, 409 PRODUCT_STATE, 500 |
| 운영자 수정 심사 이미지 열람 URL 발급 | GET | /api/v1/admin/product-reviews/{productId}/revisions/{revisionId}/images/{imageId}/download-url | path 3개. 해당 회차 스냅샷에 포함된 이미지만 | downloadUrl, expiresAt | 400, 401, 403, 404, 500, 503 PRODUCT_POLICY |

## 11. AI·분석

### AI / 분석 (AI 서비스)

공통: 일반 Gateway http://localhost:8000 (AI 직접 8086). 오류 COMMON_INVALID_REQUEST/COMMON_UNAUTHORIZED/COMMON_FORBIDDEN/PERSONALIZATION_NOT_FOUND(404)/AI_NOT_FOUND(404)/AI_NOT_OWNER(403)/500.

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 구매자 GA 분석 참여 철회 | DELETE | /api/v1/ai/analytics/identity | 없음. BUYER. 미참여에서 반복 호출해도 성공. 프론트도 GA user_id=null, analytics_storage=denied 처리 필요. Google 원격 데이터는 삭제 안 됨. 재참여 시 새 가명 발급 | 200 data=null (204 아님) | 401, 403, 500 |
| 구매자 GA 분석 참여 식별자 조회 | GET | /api/v1/ai/analytics/identity | 없음. BUYER. 로그인/화면 복원 시 호출. 자동 참여 안 시킴 | analyticsId(GA user_id용 가명 UUID), consentedAt | 401, 403, 404 PERSONALIZATION_NOT_FOUND(미참여), 500 |
| 구매자 GA 분석 참여 및 가명 식별자 발급 | POST | /api/v1/ai/analytics/identity | body: analyticsConsent(반드시 true). BUYER. 이미 참여면 기존 ID 반환 | **200**(201 아님). analyticsId, consentedAt. 이메일/AccountId/JWT를 GA로 보내지 않음, 상품 상세 view_item에 상품 id+카테고리 이름 기록 | 400, 401, 403, 500 |
| 구매자 GA 기반 관심 카테고리 프로필 조회 | GET | /api/v1/ai/analytics/profile | 없음. BUYER | analyticsEnabled, categoryName, views, lastViewedAt, profileAsOf(날짜). 미참여면 false+나머지 null, 참여했지만 집계 없으면 true+categoryName null. 최근 30개 완료 GA 날짜의 최다 조회 카테고리 1개, 실시간 아님 | 401, 403, 500 |
| 판매자 상품 AI 분석 진행 상태 및 결과 조회 | GET | /api/v1/ai/product-analyses/{id} | path id = **POST /seller/products/{id}/ai-analyses 응답의 requestId**(상품 ID 아님). SELLER JWT | requestId,productId,productVersion,fingerprint,status(PENDING/RUNNING/RETRY/COMPLETED),attempts,nextAttemptAt,result{requestId,productId,sellerId,fingerprint,outcome(RECOMMENDED/NOT_APPLICABLE/UNCLEAR),recommendedCategory(코드 예 CLOTHING),questions[{suggestionId,checkCode,question,reason}]}. 완료 전 result=null, RETRY≠실패. Kafka 미도착 시 404 가능 | 400, 401, 403 COMMON_FORBIDDEN / AI_NOT_OWNER, 404 AI_NOT_FOUND, 500 |

## 12. 프론트 연동 대상 제외

### 프론트 연동 대상 제외 (명세에는 있음)

| API명 | 메서드 | URI | 요청 | 응답 주요 필드 | 에러 |
|---|---|---|---|---|---|
| 내부, 결제 승인에 따른 재고 확정 | POST | /internal/v1/stock-reservations/{id}/confirmation | Order Command→Product 서비스 간 내부 전용(Gateway 외부 비공개). 서비스 토큰(principal_type=service, client_id=order-command-service, scope=product.stock). body: paymentAttemptId, approvedAt | ApiResponse로 감싸지 않은 StockReservationResponse 직접 반환 | 400, 401, 403, 404, 409 PRODUCT_STOCK/PRODUCT_DUPLICATE/PRODUCT_EXPIRED/PRODUCT_STATE |
| 내부, 재고 확보 결제 진행 전환 | POST | /internal/v1/stock-reservations/{id}/payment-processing | 위와 동일 내부 전용. body: paymentAttemptId | StockReservationResponse 직접 반환(status PAYMENT_PROCESSING) | 위와 동일 |
| 예시 | GET | /api/v1/ | 다른 프로젝트 템플릿 잔재(body email/password, 응답 userId/name/tokenResponse, 오류 {status,message}). 실제 API 아님 | - | - |

## 13. 집계

| 절 | 행 수 |
|---|---|
| 1. 인증 | 11 |
| 2. 회원·배송지 | 14 |
| 3. 상품(공개 조회·상품 문의) | 8 |
| 4. 주문·결제 | 19 |
| 5. 알림 | 9 |
| 6. 판매자 입점 신청(구매자 측) | 7 |
| 7. 판매자 주문·배송·문의 | 12 |
| 8. 판매자 상품 관리·등록 | 26 |
| 9. 판매자 마이페이지·주소록·스토어 | 17 |
| 10. 운영자 | 16 |
| 11. AI·분석 | 5 |
| 12. 프론트 연동 대상 제외 | 3 |
| **합계** | **147** |

연동 대상 144개 + 제외 3개 = 147개 (Notion 행 수 147개와 일치).
