# API 명세와 앱의 차이 (api-gap)

기준: `docs/api-spec.md`(Notion 147행), `docs/backend-api-requests.md`, `src/` 현재 코드(mock 데이터 기반 화면 + 일부 추정 호출).
"없다"는 명세 147행 본문에서 해당 필드·기능을 찾지 못했다는 뜻이다. 서버 구현 여부와는 무관하다.

## 1. backend-api-requests.md 요청 필드 중 명세에 없는 것

| 요청 필드 | 판정 | 명세에서 확인한 내용 |
|---|---|---|
| `Application.business.*` (상호, 대표자, 등록번호, 업태·종목, 개업연월일, 소재지) | **없음** | `SellerApplication`(신청 조회·운영자 목록·상세)에는 신청자가 입력한 값과 `maskedBankAccount`, `certificateReviewed` 뿐이다. 사업자등록증은 PDF 원본만 내려준다(`/certificate`, `/certificate-review`). OCR·운영자 입력 필드 없음 |
| `SellerSettings.business.*` (상호, 사업자등록번호 마스킹, 대표자, 업태·종목) | **없음** | `GET /sellers/me` 응답에 사업자 정보 필드 없음 |
| `Product.soldOutAt` (완판 시각) | **있음** (형식 다름) | 공개 상품 목록·상세의 `soldOutAt`(ISO, 미완판 `null`). 앱 타입은 epoch ms라 변환 필요 |
| `Product.participants` (함께 도전한 인원) | **없음** | 상품 응답에 참여 인원 필드 없음. `stock.confirmedQuantity`는 확정 수량이지 인원이 아니다 |
| `Inquiry.quantity` (문의한 주문 수량) | **없음** | 주문 문의 응답(`content[]`, 상세)에 수량 없음. 주문 상세의 `items[].quantity`로 간접 계산은 가능(문의 → `orderId` → 주문 조회) |
| `Product.description` | **있음** (심사 제출 시 필수) | 1단계 `basic-info.description`(≤20000). 최초 심사 제출 시 필수 |
| `Product.extras` (추가 정보) | **있음** (이름 다름) | 2단계 `details.attributes[{name,value}]` (필수 배열, 빈 배열 가능 여부는 명세에 없음) |
| `Product.reason` (재고 처분 사유) | **있음** (심사 제출 시 필수) | 2단계 `details.disposalReason`(≤4000) |
| `Product.faqs` | **있음** (선택) | 6단계 `registration/faqs`, 개별 추가·수정·삭제. 등록 화면에서 제외하기로 한 결정과 무관하게 API는 존재(빈 배열 허용) |
| `Product.brand` ← 판매자 표시 이름 | **있음** | `basic-info.brandOrStore`(선택, ≤200). 서버가 판매자 이름으로 자동 채우는지는 명세에 없음 |
| 카테고리 체계 (`패션 › 상의 › 니트/스웨터`) | **불일치** | 등록 카테고리는 `registration-metadata.categories`의 **이름 문자열 255개**(예 `의류`), AI 점검 기준은 `categoryCriteria.code`(`CLOTHING`). 구매자 필터 `/categories`는 이름 문자열 배열. 회원가입 관심 카테고리는 **고정 코드 12개**(`FASHION` 등)로 또 다르다. 3종이 서로 매핑되지 않는다 |
| `Product.notifySubscribers` (판매 시작 알림 신청 인원) | **없음** | 상품별 알림 신청·인원 API 없음. 알림 설정은 계정 단위(`saleStart`)만 있다 |
| `Product.reference` / `Draft.reference` (타 플랫폼 판매가 확인 결과) | **없음** | `sourceUrl` 문자열만 저장한다. 가격·플랫폼·제목 조회 API 없음. 명세도 "가격 보증 아님"이라고 명시. 앱의 "더 저렴해야 심사 요청 가능" 검증은 서버에 근거가 없다 |
| `Draft.ai.result` (`confidence`, `photos`, `found`, `alternatives`) | **없음** | AI 분석 결과는 `outcome`(RECOMMENDED/NOT_APPLICABLE/UNCLEAR), `recommendedCategory`(**코드**), `questions[{suggestionId,checkCode,question,reason}]` 뿐이다. 신뢰도·발견 속성·대안 카테고리 없음 |
| `Inquiry.images` (첨부 사진 최대 5장) | **있음** (주문 문의만) | 주문 문의는 `imageIds`(≤5) + 업로드 3단계 API. **상품 문의(구매 전)에는 이미지 없음** |

## 2. 앱 화면에서 쓰는데 API가 없는 기능

| 앱 기능 (위치) | 상태 |
|---|---|
| 주문 **취소·환불·반품·교환** (`OrderStatus` `cancelled`·`refunded`, 문의 목업의 "반품 신청하기") | 취소·환불·반품 API 전혀 없음. 명세는 "문의 등록은 취소·반품 접수를 만들지 않는다"고 명시 |
| 판매자 **배송 완료 입력**: 일시·수령 장소·메모·확인 체크 (`markDelivered`) | `delivery-completion`은 `expectedVersion`만 받는다. 일시·장소·메모는 보낼 곳이 없다 |
| 판매자 **정산·수수료** (`feeFor`: 90% 이상 판매 시 10% 수수료, 순매출) | 정산 조회 API 없음. 판매 집계는 "매출·수수료·정산 금액은 계산하지 않는다"고 명시 |
| **운영(고객센터) 1:1 문의**, FAQ·공지 (`/inquiries`, `/inquiries/compose`, `/faq`, `/support`, `/seller/support`) | 운영 문의·사이트 FAQ API 없음. 있는 문의는 상품 문의와 주문 문의 두 종류뿐이다. 상품 `faqs`는 판매자가 확인한 상품별 FAQ다 |
| **찜(북마크)** (`State.bookmarks`) | API 없음 |
| 알림 종류 — 구매자 `price_change`(관심 상품 가격 변동), `low_stock`(한정 수량 임박), 판매자 신규주문·문의·판매일정 (`NotificationSettingsPage`, `SellerSettings.notifications`) | 계정 알림 설정은 `saleStart`, `personalizedRecommendation`, `marketingConsent` 세 가지뿐이다 |
| 입점 신청의 **타 플랫폼 판매 URL** (`Application.salesUrl`) | 신청 요청 필드에 없음 |
| 회원가입 **전화번호** (`signup({phone})`) | 가입 API에 없음. 배송지·판매자 담당자 연락처에만 전화번호가 있다 |
| 계정 **알림 설정 조회** (`GET /accounts/me/notification-settings`, 앱이 호출 중) | 이 GET은 없다. 변경은 `PUT`만 있고 조회는 `GET /accounts/me`의 `notificationSettings`·`marketingConsent`에 들어 있다 |
| **FCM 푸시 토큰 등록** (`/accounts/me/device-tokens`, `firebase.ts`) | 없음. 서버는 **Web Push(VAPID)** 만 지원하고, iPhone 홈 화면 PWA(`web.push.apple.com`) 전용이다. Firebase 경로와 호환되지 않는다. → **해결**: Firebase를 지우고 `src/push.ts`·`public/sw.js`로 서버 Web Push 구독(push-configuration → 권한 → subscribe → POST, 로그아웃 전 DELETE)으로 교체 |
| 상품 **이미지 data URL 저장** (`imageData`, base64) | 서버는 base64를 받지 않는다. 업로드 권한 → S3 PUT → 완료 확인 순서만 허용 |
| 결제 **성공·실패·대기 시뮬레이션** (`paymentOutcome`) | 서버는 토스 결제창 SDK가 준 `paymentKey`로만 결제를 진행한다. 클라이언트 키는 `GET /payments/client-configuration` |

## 3. API는 있는데 화면이 없는 것

| API | 비고 |
|---|---|
| 토스 결제창 설정·결제 요청·결제 상태(`payments/client-configuration`, `orders/{id}/payment-attempts`, `orders/{id}/checkout`) | `CheckoutPage`는 목업 hold·시뮬레이션을 쓴다. 토스 SDK 연동 화면 없음 |
| 결제 약관 조회(`orders/checkout-terms[/{version}]`) | 결제 화면에 약관 동의 UI 없음 (서버가 동의 버전을 주문에 기록한다) |
| 알림 읽음 처리·안 읽은 개수(`notifications/read-all`, `unread-count`, `{id}/read`), 알림 상세 이동(`notifications/{id}`, 푸시 클릭 `/?notificationId=`) | `NotificationsPage`는 목업이다 |
| 웹 푸시 구독 관리(`push-configuration`, `push-subscriptions` 조회·등록·해제) | 현재는 Firebase 코드뿐 |
| GA 분석 참여·프로필(`ai/analytics/identity`, `ai/analytics/profile`) | 화면 없음, GA 이벤트 전송 코드 없음 |
| 회원 탈퇴 가능 여부·탈퇴(`accounts/me/withdrawal-eligibility`, `DELETE accounts/me`) | 판매자 설정 탈퇴 화면은 있으나 토스트만 띄운다(서버 호출 없음) |
| 관심 카테고리(`signup.interestCategories`, `PUT accounts/me/interests`) | `CategorySelectionPage`(선택지 12개는 `signup-options` 라벨과 같다)는 `localStorage`에만 저장한다. 가입 요청에 실리지 않고 변경 API도 호출하지 않는다 |
| 상품 수정 심사(`seller/products/{id}/revisions` 조회·제출, 운영자 `product-reviews/revisions`) | 앱의 "판매 정보 수정"은 로컬 상태를 덮어쓴다. 승인 상품은 서버에서 수정 심사 회차로만 바꿀 수 있고 가격·옵션·수량은 수정 대상이 아니다 |
| 판매자 사업자등록증 재심사(`sellers/me/certificate-reviews`, `review-status`) | 화면 없음. 재심사 중에는 판매자 변경 업무가 `SELLER_SALES_RESTRICTED`(403)로 막힌다 |
| 판매자 주소록(`sellers/me/address-book/{type}` CRUD·기본 지정) | 화면은 출고·반품 주소 한 쌍만 편집한다 |
| 판매자 스토어 소개·로고(`sellers/me/store`, `store/logo`) | 로고 변경 버튼은 있으나 핸들러가 없다. 소개 입력란은 없다 |
| 입점 신청 이력·보완 요청 조회·보완 제출(`seller-applications/me/history`, `{id}/correction-request`, `{id}/resubmissions`) | 앱 코드에 이 경로 호출이 없다. 운영자 보완 요청 목업(`rejectionItems`)만 있다 |
| 판매자 상품 문의 답변·FAQ 반영(`seller/products/{id}/inquiries/{id}/answer`, `publishToFaq`) | 문의 상세 목업만 |
| 주문 문의 이미지 업로드·열람(`orders/{order}/inquiry-images…`) | 앱 코드에 이 경로 호출이 없다 |
| 상품 이미지 업로드·정렬·열람(`seller/products/{id}/image-uploads`, `images…`) | 등록 화면은 data URL 이미지만 쓴다 |
| 상품 AI 분석(`seller/products/{id}/ai-analyses` → `ai/product-analyses/{requestId}`) | 화면은 mock 분석. 점검 질문 → FAQ 저장 흐름 없음 |
| 상품 등록 단계별 저장(`registration/basic-info … faqs`, `review-submissions`) | 앱은 한 화면에서 한 번에 게시. 서버는 6단계 PUT + 심사 제출 |
| 상품 등록 메타데이터(`seller/products/registration-metadata`, 255개 분류) | 앱 카테고리는 하드코딩 13개 |
| 판매자 판매·재고 집계(`seller/products/sales-summary`), 주문·배송 집계(`seller/orders/summary`) | 앱은 로컬 주문으로 직접 계산 |
| 판매자 출고(`seller/orders/{id}/shipment`, `fulfillment`) | 화면은 있으나 서버 version 기반 호출 없음 |
| 공개 상품 일정 달력(`products/schedule`) | `CalendarPage`는 로컬 데이터 |

## 4. 부록: 기존 화면·모듈의 추정 호출 중 명세와 다른 것

명세가 나오기 전에 추정해서 넣은 호출이다. 이번 단계에서는 인증 외에는 고치지 않았고, 아래 항목은 후속 연동 때 고쳐야 한다.

| 위치 | 현재 호출 | 명세 |
|---|---|---|
| `pages/address.tsx` | `PATCH /accounts/me/addresses/{id}/default` | `PUT` |
| `pages/address.tsx` | 배송지 등록 응답을 `SavedAddress` 전체로 가정 | 등록 응답은 `{addressId, defaultAddress}` 뿐 |
| `pages/seller.tsx` | `PUT /sellers/me/bank-account` 본문 `bankAccount` | 필드명 `bankAccountNumber` |
| `pages/account.tsx` | `POST /admin/products/{id}/approve`, `/reject` | `POST /admin/product-reviews/{id}/decisions` 본문 `{expectedVersion, approved, reason}` (PurchaseGateway) |
| `pages/account.tsx` | `POST /admin/seller-applications/{id}/reject` 본문 `{reason}` | 일치. 단 승인 전 `POST …/certificate-review`(PDF 열람)를 먼저 호출해야 한다(409 `SELLER_CERTIFICATE_REVIEW_REQUIRED`) |
| `pages/account.tsx` | `POST /seller-applications`(FormData) | 파트 이름은 `application`(JSON)과 `certificate`(PDF)여야 한다. 개별 필드를 FormData에 넣으면 안 된다 |
| `auth.ts` 회원가입 | 비밀번호 8~32자 | 서버 8~64자. 영문·숫자·특수문자 포함은 동일 |
| `auth.ts` 로그인 | CSRF → 로그인 | 일치. 응답 `roles`는 대문자 문자열 배열 |
| ~~`firebase.ts`~~ | `POST /accounts/me/device-tokens` | 없음 (2절) → Web Push로 교체, 파일 삭제 |
