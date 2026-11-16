# API 연동 상태

> 기준: Notion "API 명세" 데이터베이스 147행 전체 조회(2026-11-16), 코드 기준 `feat/api-integration`(`docs/api-status` 브랜치). 상태는 `src/api/*` 함수와 화면 호출을 직접 확인한 결과다.

## 상태별 개수

| 상태 | 개수 |
|---|---|
| 연동 완료 | 113 |
| 함수만 있음 | 27 |
| 미연동 | 4 |
| 제외 | 3 |
| **합계** | **147** |

- 연동 완료: API 함수가 있고 화면에서 실제로 호출(다른 함수 안에서 불러 간접 호출되는 경우 포함)
- 함수만 있음: API 함수는 있으나 화면에서 부르지 않음
- 미연동: API 함수 없음
- 제외: 프론트에서 부르지 않는 API(내부 호출, 템플릿 잔재)

## 이전 정리본(docs/api-spec.md)과 달라진 API

없음. 메서드·경로·API명 모두 147행이 일치한다. (요청·응답 필드는 이번에 비교하지 않았다 — Notion 각 행 본문은 조회하지 않음)

## 함수만 있음 / 미연동 목록

### 함수만 있음

- GET `/api/v1/admin/product-reviews/{productId}/revisions/{revisionId}/images/{imageId}/download-url` — 운영자 수정 심사 이미지 열람 URL 발급 (getAdminRevisionImageUrl)
- GET `/api/v1/sellers/me/review-status` — 내 판매자 재심사 상태 조회 (fetchReviewStatus — 재심사 상태 화면 없음)
- GET `/api/v1/admin/product-reviews/revisions` — 운영자 상품 수정 심사 목록 조회 (listAdminRevisions — 수정 심사 화면 없음)
- GET `/api/v1/admin/seller-applications/{id}/correction-request` — 운영자 판매자 신청 보완 요청 조회 (getCorrectionRequest)
- GET `/api/v1/sellers/me/address-book/{type}/{id}` — 판매자 주소록 단건 조회 (fetchAddressBook — 수정 화면은 목록 응답에서 찾음)
- GET `/api/v1/seller/orders/{order}/inquiry-images/{id}/download` — 판매자 주문 문의 이미지 열람 URL 발급 (getSellerInquiryImageUrl — 판매자 문의 상세에 첨부 사진 표시 없음)
- POST `/api/v1/products/{productId}/inquiries` — 구매자 상품 문의 등록 (createProductInquiry — 호출하는 화면 없음)
- GET `/api/v1/seller-applications/{applicationId}` — 내 판매자 신청 단건 조회 (fetchApplication)
- GET `/api/v1/accounts/me/addresses/{addressId}` — 내 배송지 단건 조회 (fetchAddress — 수정 화면은 목록 응답에서 찾음)
- POST `/api/v1/admin/product-reviews/{productId}/revisions/{revisionId}/decisions` — 운영자 상품 수정 심사 승인 및 반려 (decideRevision)
- POST `/api/v1/seller/products/{id}/faqs` — 검증 FAQ 개별 추가 (addProductFaq — 등록 화면은 6단계 전체 저장(registration/faqs) 사용)
- GET `/api/v1/admin/product-reviews/{productId}/revisions/{revisionId}` — 운영자 상품 수정 심사 상세 조회 (getAdminRevision)
- POST `/api/v1/sellers/me/certificate-reviews` — 판매자 사업자등록증 재심사 신청 (requestCertificateReview — 사업자등록증 재심사 신청 화면 없음)
- GET `/api/v1/seller-applications/me/history` — 내 판매자 신청 이력 조회 (fetchApplicationHistory)
- GET `/api/v1/orders/{order}/inquiries/{id}/editing` — 구매자 주문 문의 작성용 원본 조회 (getInquiryEditing)
- DELETE `/api/v1/seller/products/{id}/faqs/{faqId}` — 검증 FAQ 개별 삭제 (deleteProductFaq)
- GET `/api/v1/orders/checkout-terms/{version}` — 지정 버전 주문 결제 약관 조회 (getCheckoutTermsVersion)
- GET `/api/v1/seller/orders/{order}/inquiries/{id}/editing` — 판매자 주문 문의 답변용 원본 조회 (getSellerInquiryEditing — 답변 등록 시 version을 쓰지 않음)
- PUT `/api/v1/seller/products/{id}/faqs/{faqId}` — 검증 FAQ 개별 수정 (updateProductFaq)
- GET `/api/v1/products/{id}/faqs` — 공개 상품 검증 FAQ 조회 (getProductFaqs — 상품 상세 응답(faqs)을 그대로 사용)
- GET `/api/v1/products/{id}/inquiries` — 구매자 본인 상품 문의 및 답변 조회 (listProductInquiries — 상품 상세에 구매자 상품 문의 화면 없음)
- GET `/api/v1/orders/{id}/inquiries` — 구매자 주문별 문의 목록 조회 (listOrderInquiries — 화면은 문의함(/orders/inquiries)과 상세만 사용)
- POST `/api/v1/admin/seller-applications/{id}/correction-request` — 운영자 판매자 신청 보완 요청 (requestCorrection — 운영자 반려 화면은 단일 사유(reject)만)
- GET `/api/v1/notifications/push-subscriptions` — 본인 기기 웹 푸시 구독 목록 조회 (listPushSubscriptions)
- GET `/api/v1/categories` — 공개 상품 카테고리 필터 목록 조회 (listCategories — 홈 카테고리 칩은 고정 목록)
- GET `/api/v1/products/{id}/options` — 공개 상품 옵션 및 표시 재고 조회 (getProductOptions — 상품 상세 응답(options)을 그대로 사용)
- GET `/api/v1/products/schedule` — 공개 상품 판매 일정 달력 조회 (getSchedule — 판매 일정 화면은 상품 목록(startsFrom/startsTo)으로 구성)

### 미연동

- POST `/api/v1/ai/analytics/identity` — 구매자 GA 분석 참여 및 가명 식별자 발급 (GA 분석 참여 식별자 API 함수 없음 (src/analytics.ts는 GA만 초기화))
- GET `/api/v1/ai/analytics/identity` — 구매자 GA 분석 참여 식별자 조회 (함수 없음)
- GET `/api/v1/ai/analytics/profile` — 구매자 GA 기반 관심 카테고리 프로필 조회 (함수 없음)
- DELETE `/api/v1/ai/analytics/identity` — 구매자 GA 분석 참여 철회 (함수 없음)

## 도메인별 상태

### 입점 심사

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 운영자 판매자 신청 상세 | GET | `/api/v1/admin/seller-applications/{applicationId}` | 연동 완료 | 운영자 입점 심사 상세 |  |
| 운영자 판매자 신청 보완 요청 조회 | GET | `/api/v1/admin/seller-applications/{id}/correction-request` | 함수만 있음 | - | getCorrectionRequest |
| 판매자 신청 승인 | POST | `/api/v1/admin/seller-applications/{applicationId}/approve` | 연동 완료 | 운영자 입점 심사 승인 |  |
| 판매자 신청 거절 | POST | `/api/v1/admin/seller-applications/{applicationId}/reject` | 연동 완료 | 운영자 입점 심사 반려 |  |
| 운영자 판매자 신청 목록 | GET | `/api/v1/admin/seller-applications` | 연동 완료 | 운영자 입점 심사 목록·마이페이지 대기 건수 |  |
| 운영자 PDF 열람 및 기록 | POST | `/api/v1/admin/seller-applications/{applicationId}/certificate-review` | 연동 완료 | 운영자 입점 심사 상세 PDF 열람 |  |
| 운영자 판매자 신청 보완 요청 | POST | `/api/v1/admin/seller-applications/{id}/correction-request` | 함수만 있음 | - | requestCorrection — 운영자 반려 화면은 단일 사유(reject)만 |

### 상품 수정 심사

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 운영자 수정 심사 이미지 열람 URL 발급 | GET | `/api/v1/admin/product-reviews/{productId}/revisions/{revisionId}/images/{imageId}/download-url` | 함수만 있음 | - | getAdminRevisionImageUrl |
| 판매자 상품 수정 심사 이력 조회 | GET | `/api/v1/seller/products/{id}/revisions` | 연동 완료 | 판매 상품 상세 수정 심사 이력 |  |
| 운영자 상품 수정 심사 목록 조회 | GET | `/api/v1/admin/product-reviews/revisions` | 함수만 있음 | - | listAdminRevisions — 수정 심사 화면 없음 |
| 운영자 상품 수정 심사 승인 및 반려 | POST | `/api/v1/admin/product-reviews/{productId}/revisions/{revisionId}/decisions` | 함수만 있음 | - | decideRevision |
| 운영자 상품 수정 심사 상세 조회 | GET | `/api/v1/admin/product-reviews/{productId}/revisions/{revisionId}` | 함수만 있음 | - | getAdminRevision |
| 승인 상품 수정 심사 제출 | POST | `/api/v1/seller/products/{id}/revisions` | 연동 완료 | 판매 정보 수정 제출 |  |

### 판매 집계

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 판매자 상품 판매 및 재고 집계 조회 | GET | `/api/v1/seller/products/sales-summary` | 연동 완료 | 판매자 상품 관리·판매 현황 |  |
| 판매자 주문 및 배송 상태 집계 조회 | GET | `/api/v1/seller/orders/summary` | 연동 완료 | 판매자 주문 목록 |  |

### 배송지 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 배송지 삭제 | DELETE | `/api/v1/accounts/me/addresses/{addressId}` | 연동 완료 | 배송지 관리 |  |
| 내 배송지 단건 조회 | GET | `/api/v1/accounts/me/addresses/{addressId}` | 함수만 있음 | - | fetchAddress — 수정 화면은 목록 응답에서 찾음 |
| 선택한 배송지 수정 | PUT | `/api/v1/accounts/me/addresses/{addressId}` | 연동 완료 | 배송지 수정 |  |
| 내 배송지 목록 조회 | GET | `/api/v1/accounts/me/addresses` | 연동 완료 | 배송지 관리, 결제 배송지 선택 |  |
| 배송지 등록 | POST | `/api/v1/accounts/me/addresses` | 연동 완료 | 새 배송지 입력 |  |
| 기본 배송지 지정 | PUT | `/api/v1/accounts/me/addresses/{addressId}/default` | 연동 완료 | 배송지 관리 |  |
| 구매자 결제 전 주문 배송지 변경 | PATCH | `/api/v1/orders/{id}/shipping-address` | 연동 완료 | 결제 /checkout/:id |  |

### 판매 일정

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 상품 등록 5단계, 판매 일정 저장 | PUT | `/api/v1/seller/products/{id}/registration/schedule` | 연동 완료 | 상품 등록 /seller/new (제출 시 단계별 저장) |  |
| 공개 상품 판매 일정 달력 조회 | GET | `/api/v1/products/schedule` | 함수만 있음 | - | getSchedule — 판매 일정 화면은 상품 목록(startsFrom/startsTo)으로 구성 |

### 상품 이미지

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 상품 편집용 이미지 목록 조회 | GET | `/api/v1/seller/products/{productId}/images` | 연동 완료 | AI 분석 전 서버 재확인 (analyzeDraft) |  |
| 상품 이미지 연결 해제 | DELETE | `/api/v1/seller/products/{productId}/images/{imageId}` | 연동 완료 | 상품 등록 사진 삭제 |  |
| 판매자 상품 이미지 열람 URL 발급 | GET | `/api/v1/seller/products/{productId}/images/{imageId}/download-url` | 연동 완료 | 상품 등록·수정 사진 표시 |  |
| 상품 이미지 업로드 완료 확인 | POST | `/api/v1/seller/products/{productId}/images/{imageId}/completion` | 연동 완료 | 상품 등록 사진 업로드 |  |
| 상품 이미지 순서 및 대표 이미지 변경 | PUT | `/api/v1/seller/products/{productId}/images` | 연동 완료 | 상품 등록 사진 순서·대표 |  |
| 상품 이미지 직접 업로드 권한 발급 | POST | `/api/v1/seller/products/{productId}/image-uploads` | 연동 완료 | 상품 등록 사진 업로드 |  |

### 비밀번호 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 현재 비밀번호로 비밀번호 변경 | PUT | `/api/v1/accounts/me/password` | 연동 완료 | 마이페이지 비밀번호 변경 |  |
| 비밀번호 재설정 인증번호 확인 | POST | `/api/v1/auth/password-resets/confirm` | 연동 완료 | 비밀번호 재설정 /reset-password |  |
| 비밀번호 재설정 인증번호 요청 | POST | `/api/v1/auth/password-resets` | 연동 완료 | 비밀번호 재설정 /reset-password |  |
| 새 비밀번호 저장 | POST | `/api/v1/auth/password-resets/complete` | 연동 완료 | 비밀번호 재설정 /reset-password |  |

### 예시

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 예시 | GET | `/api/v1/` | 제외 | - | 템플릿 잔재 예시 API, 실제 API 아님 |

### 로그아웃

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 현재 로그인 세션 종료 | POST | `/api/v1/auth/logout` | 연동 완료 | 마이페이지 로그아웃 |  |

### 판매자 신청

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 내 판매자 재심사 상태 조회 | GET | `/api/v1/sellers/me/review-status` | 함수만 있음 | - | fetchReviewStatus — 재심사 상태 화면 없음 |
| 판매자 입점 신청 | POST | `/api/v1/seller-applications` | 연동 완료 | 입점 신청 /apply |  |
| 내 판매자 신청 단건 조회 | GET | `/api/v1/seller-applications/{applicationId}` | 함수만 있음 | - | fetchApplication |
| 판매자 신청 보완 제출 | POST | `/api/v1/seller-applications/{id}/resubmissions` | 연동 완료 | 입점 신청 /apply (보완 제출) |  |
| 내 판매자 신청 이력 조회 | GET | `/api/v1/seller-applications/me/history` | 함수만 있음 | - | fetchApplicationHistory |
| 내 판매자 신청 보완 요청 조회 | GET | `/api/v1/seller-applications/{id}/correction-request` | 연동 완료 | 마이페이지·입점 신청 (fetchMyApplication 경유) |  |
| 내 최신 판매자 신청 조회 | GET | `/api/v1/seller-applications/me` | 연동 완료 | 마이페이지·입점 신청 |  |

### 배송 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 판매자 수동 배송 완료 처리 | POST | `/api/v1/seller/orders/{id}/delivery-completion` | 연동 완료 | 판매자 주문 상세 배송 완료 |  |
| 판매자 송장 등록 및 배송 시작 | POST | `/api/v1/seller/orders/{id}/shipment` | 연동 완료 | 판매자 주문 상세 송장 등록 |  |
| 판매자 출고 작업용 원본 주문 조회 | GET | `/api/v1/seller/orders/{id}/fulfillment` | 연동 완료 | 송장 등록·배송 완료 (shipOrder, deliverOrder 경유) |  |

### 판매자 정보 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 내 판매자 마이페이지 정보 조회 | GET | `/api/v1/sellers/me` | 연동 완료 | 판매자 마이페이지·설정 |  |
| 내 판매자 표시 이름과 담당자 정보 수정 | PUT | `/api/v1/sellers/me/contact` | 연동 완료 | 판매자 설정 > 계정 |  |

### 회원탈퇴

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 회원 탈퇴 가능 여부 조회 | GET | `/api/v1/accounts/me/withdrawal-eligibility` | 연동 완료 | 판매자 설정 > 회원 탈퇴 |  |
| 회원 탈퇴 | DELETE | `/api/v1/accounts/me` | 연동 완료 | 판매자 설정 > 회원 탈퇴 |  |

### 주문 문의 이미지

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 구매자 미연결 주문 문의 이미지 폐기 | DELETE | `/api/v1/orders/{order}/inquiry-images/{id}` | 연동 완료 | 주문 문의 작성 사진 삭제 |  |
| 구매자 주문 문의 이미지 업로드 완료 확인 | POST | `/api/v1/orders/{order}/inquiry-images/{id}/completion` | 연동 완료 | 주문 문의 작성 사진 첨부 (uploadInquiryImage 경유) |  |
| 판매자 주문 문의 이미지 열람 URL 발급 | GET | `/api/v1/seller/orders/{order}/inquiry-images/{id}/download` | 함수만 있음 | - | getSellerInquiryImageUrl — 판매자 문의 상세에 첨부 사진 표시 없음 |
| 구매자 주문 문의 이미지 열람 URL 발급 | GET | `/api/v1/orders/{order}/inquiry-images/{id}/download` | 연동 완료 | 문의 상세 첨부 사진 |  |
| 구매자 주문 문의 이미지 업로드 권한 발급 | POST | `/api/v1/orders/{order}/inquiry-images` | 연동 완료 | 주문 문의 작성 사진 첨부 |  |

### 스토어 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 내 스토어 소개 수정 | PUT | `/api/v1/sellers/me/store` | 연동 완료 | 판매자 설정 > 스토어 |  |
| 내 스토어 설정 조회 | GET | `/api/v1/sellers/me/store` | 연동 완료 | 판매자 설정 > 스토어 |  |
| 내 스토어 로고 등록 또는 교체 | POST | `/api/v1/sellers/me/store/logo` | 연동 완료 | 판매자 설정 > 스토어 |  |
| 내 스토어 로고 이미지 조회 | GET | `/api/v1/sellers/me/store/logo` | 연동 완료 | 판매자 설정 > 스토어 |  |
| 내 스토어 로고 삭제 | DELETE | `/api/v1/sellers/me/store/logo` | 연동 완료 | 판매자 설정 > 스토어 |  |

### 로그인

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 로그인 전 CSRF 토큰 준비 | GET | `/api/v1/auth/csrf` | 연동 완료 | 로그인·로그아웃(전 화면 자동) | api/client.ts가 쿠키 변경 요청 전에 호출 |
| 이메일 로그인 | POST | `/api/v1/auth/login` | 연동 완료 | 로그인 /login |  |

### 토큰

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| Access JWT 재발급 | POST | `/api/v1/auth/refresh` | 연동 완료 | 전 화면(401 자동 재발급, 새로고침 복구) | api/client.ts, auth.ts restoreSession |

### 출고지와 반품지 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 판매자 주소록 단건 조회 | GET | `/api/v1/sellers/me/address-book/{type}/{id}` | 함수만 있음 | - | fetchAddressBook — 수정 화면은 목록 응답에서 찾음 |
| 내 판매자 출고와 반품 주소 수정 | PUT | `/api/v1/sellers/me/addresses` | 연동 완료 | 판매자 설정 > 출고지·반품지 |  |
| 판매자 기본 출고지 또는 반품지 지정 | PUT | `/api/v1/sellers/me/address-book/{type}/{id}/default` | 연동 완료 | 판매자 주소록 |  |
| 판매자 주소록 등록 | POST | `/api/v1/sellers/me/address-book/{type}` | 연동 완료 | 판매자 주소록 |  |
| 판매자 주소록 목록 조회 | GET | `/api/v1/sellers/me/address-book/{type}` | 연동 완료 | 판매자 주소록, 상품 등록 출고지 선택 |  |
| 판매자 주소록 삭제 | DELETE | `/api/v1/sellers/me/address-book/{type}/{id}` | 연동 완료 | 판매자 주소록 |  |
| 판매자 주소록 단건 수정 | PUT | `/api/v1/sellers/me/address-book/{type}/{id}` | 연동 완료 | 판매자 주소록 |  |

### 회원가입

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 인증번호 확인 | POST | `/api/v1/auth/email-verifications/confirm` | 연동 완료 | 회원가입 /signup, /signup/verify |  |
| 이메일 회원가입 | POST | `/api/v1/auth/signup` | 연동 완료 | 회원가입 /signup/info |  |
| 가입 인증번호 발송 | POST | `/api/v1/auth/email-verifications` | 연동 완료 | 회원가입 /signup, /signup/verify |  |
| 회원가입 선택 항목 조회 | GET | `/api/v1/signup-options` | 연동 완료 | 관심 카테고리 선택 /categories (fetchMySettings 경유) |  |

### 상품 문의

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 구매자 상품 문의 등록 | POST | `/api/v1/products/{productId}/inquiries` | 함수만 있음 | - | createProductInquiry — 호출하는 화면 없음 |
| 판매자 본인 상품 문의함 조회 | GET | `/api/v1/seller/products/inquiries` | 연동 완료 | 판매자 문의함(상품 문의) |  |
| 상품 문의 답변 작성 및 수정 | PUT | `/api/v1/seller/products/{productId}/inquiries/{inquiryId}/answer` | 연동 완료 | 판매자 문의 상세 답변 |  |
| 구매자 본인 상품 문의 및 답변 조회 | GET | `/api/v1/products/{id}/inquiries` | 함수만 있음 | - | listProductInquiries — 상품 상세에 구매자 상품 문의 화면 없음 |

### 상품 옵션과 재고

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 상품 등록 3단계, 옵션 및 최초 재고 저장 | PUT | `/api/v1/seller/products/{id}/registration/options` | 연동 완료 | 상품 등록 /seller/new (제출 시 단계별 저장) |  |
| 공개 상품 옵션 및 표시 재고 조회 | GET | `/api/v1/products/{id}/options` | 함수만 있음 | - | getProductOptions — 상품 상세 응답(options)을 그대로 사용 |

### 마이페이지

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 내 정보와 설정 조회 | GET | `/api/v1/accounts/me` | 연동 완료 | 알림 설정·관심 카테고리, 로그인 직후 이름 |  |
| 내 이름 수정 | PATCH | `/api/v1/accounts/me` | 연동 완료 | 마이페이지 내 정보 수정 | 연락처는 API 없음(기기 저장) |

### 상품 심사

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 운영자 최초 상품 심사 상세 조회 | GET | `/api/v1/admin/product-reviews/{id}` | 연동 완료 | 운영자 판매 심사 상세 |  |
| 운영자 상품 최초 심사 승인 및 반려 | POST | `/api/v1/admin/product-reviews/{id}/decisions` | 연동 완료 | 운영자 판매 심사 승인·반려 |  |
| 운영자 최초 상품 심사 목록 조회 | GET | `/api/v1/admin/product-reviews` | 연동 완료 | 운영자 판매 심사 목록·마이페이지 대기 건수 |  |
| 상품 최초 심사 제출 | POST | `/api/v1/seller/products/{id}/review-submissions` | 연동 완료 | 상품 등록 제출 |  |
| 운영자 상품 심사용 이미지 열람 URL 발급 | GET | `/api/v1/admin/product-reviews/{id}/images/{imageId}/download-url` | 연동 완료 | 상품 등록·수정 사진 표시 |  |
| 운영자 상품 심사용 이미지 목록 조회 | GET | `/api/v1/admin/product-reviews/{id}/images` | 연동 완료 | 운영자 판매 심사 상세 (사진) |  |

### 상품 등록

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 상품 등록 4단계, 가격 및 배송 저장 | PUT | `/api/v1/seller/products/{id}/registration/pricing-shipping` | 연동 완료 | 상품 등록 /seller/new (제출 시 단계별 저장) |  |
| 상품 등록 1단계, 기본 정보 저장 | PUT | `/api/v1/seller/products/{id}/registration/basic-info` | 연동 완료 | 상품 등록 /seller/new (제출 시 단계별 저장) |  |
| 상품 등록 초안 생성 | POST | `/api/v1/seller/products` | 연동 완료 | 상품 등록 /seller/new (초안 생성) |  |
| 상품 등록 2단계, 상세 속성 및 처분 사유 저장 | PUT | `/api/v1/seller/products/{id}/registration/details` | 연동 완료 | 상품 등록 /seller/new (제출 시 단계별 저장) |  |

### 결제

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 주문 결제 승인 처리 요청 | POST | `/api/v1/orders/{id}/payment-attempts` | 연동 완료 | 결제 /checkout/:id (토스 복귀) |  |
| 구매자 결제용 원본 주문 상태 조회 | GET | `/api/v1/orders/{id}/checkout` | 연동 완료 | 결제 /checkout/:id |  |
| 토스 결제창 공개 클라이언트 설정 조회 | GET | `/api/v1/payments/client-configuration` | 연동 완료 | 결제 /checkout/:id (openTossPayment 경유) |  |

### 주문 문의

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 판매자 주문 문의 답변 등록 | POST | `/api/v1/seller/orders/{order}/inquiries/{id}/answers` | 연동 완료 | 판매자 문의 상세 답변 |  |
| 구매자 주문 문의 추가 메시지 등록 | POST | `/api/v1/orders/{order}/inquiries/{id}/messages` | 연동 완료 | 문의 상세 추가 문의 |  |
| 구매자 주문 문의 작성용 원본 조회 | GET | `/api/v1/orders/{order}/inquiries/{id}/editing` | 함수만 있음 | - | getInquiryEditing |
| 판매자 주문 문의 답변용 원본 조회 | GET | `/api/v1/seller/orders/{order}/inquiries/{id}/editing` | 함수만 있음 | - | getSellerInquiryEditing — 답변 등록 시 version을 쓰지 않음 |
| 판매자 전체 주문 문의함 조회 | GET | `/api/v1/seller/orders/inquiries` | 연동 완료 | 판매자 문의함 /seller/inquiries |  |
| 구매자 주문 문의 상세 조회 | GET | `/api/v1/orders/{id}/inquiries/{inquiryId}` | 연동 완료 | 문의 상세 /inquiries/:id |  |
| 구매자 주문별 문의 목록 조회 | GET | `/api/v1/orders/{id}/inquiries` | 함수만 있음 | - | listOrderInquiries — 화면은 문의함(/orders/inquiries)과 상세만 사용 |
| 판매자 주문별 문의 목록 조회 | GET | `/api/v1/seller/orders/{id}/inquiries` | 연동 완료 | 판매자 문의 상세 |  |
| 판매자 주문 문의 상세 조회 | GET | `/api/v1/seller/orders/{id}/inquiries/{inquiryId}` | 연동 완료 | 판매자 문의 상세 |  |
| 구매자 주문 문의 등록 | POST | `/api/v1/orders/{order}/inquiries` | 연동 완료 | 주문 문의 작성 /orders/:id/inquiry |  |
| 구매자 전체 주문 문의함 조회 | GET | `/api/v1/orders/inquiries` | 연동 완료 | 문의함 /inquiries |  |

### 상품 FAQ

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 검증 FAQ 개별 추가 | POST | `/api/v1/seller/products/{id}/faqs` | 함수만 있음 | - | addProductFaq — 등록 화면은 6단계 전체 저장(registration/faqs) 사용 |
| 상품 등록 6단계, 검증 FAQ 전체 저장 | PUT | `/api/v1/seller/products/{id}/registration/faqs` | 연동 완료 | 상품 등록 /seller/new (제출 시 단계별 저장) |  |
| 검증 FAQ 개별 삭제 | DELETE | `/api/v1/seller/products/{id}/faqs/{faqId}` | 함수만 있음 | - | deleteProductFaq |
| 검증 FAQ 개별 수정 | PUT | `/api/v1/seller/products/{id}/faqs/{faqId}` | 함수만 있음 | - | updateProductFaq |
| 공개 상품 검증 FAQ 조회 | GET | `/api/v1/products/{id}/faqs` | 함수만 있음 | - | getProductFaqs — 상품 상세 응답(faqs)을 그대로 사용 |

### 상품 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 판매자 본인 상품 관리 목록 조회 | GET | `/api/v1/seller/products` | 연동 완료 | 판매 상품 관리 /seller/products |  |
| 판매자 본인 상품 편집 정보 조회 | GET | `/api/v1/seller/products/{id}` | 연동 완료 | 판매 상품 상세·수정 |  |

### 카테고리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 상품 등록 카테고리 및 AI 점검 기준 조회 | GET | `/api/v1/seller/products/registration-metadata` | 연동 완료 | 상품 등록 /seller/new |  |
| 공개 상품 카테고리 필터 목록 조회 | GET | `/api/v1/categories` | 함수만 있음 | - | listCategories — 홈 카테고리 칩은 고정 목록 |

### 사업자등록증 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 판매자 사업자등록증 재심사 신청 | POST | `/api/v1/sellers/me/certificate-reviews` | 함수만 있음 | - | requestCertificateReview — 사업자등록증 재심사 신청 화면 없음 |
| 내 사업자등록증 PDF 조회 | GET | `/api/v1/seller-applications/{applicationId}/certificate` | 연동 완료 | 입점 신청 PDF 보기 (files.ts) |  |

### 광고 수신 동의

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 광고성 알림 동의 또는 철회 | PUT | `/api/v1/accounts/me/marketing-consent` | 연동 완료 | 회원가입, 알림 설정 |  |

### 재고 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 내부, 결제 승인에 따른 재고 확정 | POST | `/internal/v1/stock-reservations/{id}/confirmation` | 제외 | - | 서비스 간 내부 호출, 프론트에서 부르지 않음 |
| 내부, 재고 확보 결제 진행 전환 | POST | `/internal/v1/stock-reservations/{id}/payment-processing` | 제외 | - | 서비스 간 내부 호출, 프론트에서 부르지 않음 |

### 알림 설정

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 알림 유형 설정 변경 | PUT | `/api/v1/accounts/me/notification-settings` | 연동 완료 | 알림 설정 /notifications/settings |  |

### 주문

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 주문 생성 및 재고 확보 요청 | POST | `/api/v1/orders` | 연동 완료 | 상품 상세 옵션 선택 > 구매하기 | ORDER_UNAVAILABLE 자동 재시도 |

### 결제 약관

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 지정 버전 주문 결제 약관 조회 | GET | `/api/v1/orders/checkout-terms/{version}` | 함수만 있음 | - | getCheckoutTermsVersion |
| 현재 주문 결제 약관 조회 | GET | `/api/v1/orders/checkout-terms` | 연동 완료 | 결제 /checkout/:id |  |

### 상품 AI 분석

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 상품 AI 카테고리 및 등록 정보 점검 요청 | POST | `/api/v1/seller/products/{id}/ai-analyses` | 연동 완료 | AI 상품분석 /seller/new/ai |  |
| 판매자 상품 AI 분석 진행 상태 및 결과 조회 | GET | `/api/v1/ai/product-analyses/{id}` | 연동 완료 | AI 분석 중·결과 화면 |  |

### 관심 카테고리 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 관심 카테고리 전체 변경 | PUT | `/api/v1/accounts/me/interests` | 연동 완료 | 관심 카테고리 /categories |  |

### 분석 참여

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 구매자 GA 분석 참여 및 가명 식별자 발급 | POST | `/api/v1/ai/analytics/identity` | 미연동 | - | GA 분석 참여 식별자 API 함수 없음 (src/analytics.ts는 GA만 초기화) |
| 구매자 GA 분석 참여 식별자 조회 | GET | `/api/v1/ai/analytics/identity` | 미연동 | - | 함수 없음 |
| 구매자 GA 분석 참여 철회 | DELETE | `/api/v1/ai/analytics/identity` | 미연동 | - | 함수 없음 |

### 정산 계좌 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 내 판매자 정산 계좌 수정 | PUT | `/api/v1/sellers/me/bank-account` | 연동 완료 | 판매자 설정 > 정산 계좌 |  |

### 알림

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 본인 알림함 목록 조회 | GET | `/api/v1/notifications` | 연동 완료 | 알림 /notifications |  |
| 본인 알림 전체 읽음 처리 | PATCH | `/api/v1/notifications/read-all` | 연동 완료 | 알림 /notifications |  |
| 본인 알림 단건 읽음 처리 | PATCH | `/api/v1/notifications/{id}/read` | 연동 완료 | 알림 /notifications |  |
| 본인 안 읽은 알림 개수 조회 | GET | `/api/v1/notifications/unread-count` | 연동 완료 | 홈 알림 표시 |  |
| 본인 알림 상세 및 이동 대상 조회 | GET | `/api/v1/notifications/{id}` | 연동 완료 | 푸시 클릭 진입(App.tsx) |  |

### 주문 조회

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 구매자 본인 주문 상세 조회 | GET | `/api/v1/orders/{id}` | 연동 완료 | 주문 상세 /orders/:id |  |
| 구매자 본인 주문 목록 조회 | GET | `/api/v1/orders` | 연동 완료 | 주문 목록 /orders |  |

### 푸시 구독

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 본인 브라우저 웹 푸시 구독 등록 및 갱신 | POST | `/api/v1/notifications/push-subscriptions` | 연동 완료 | 알림 설정 푸시 (push.ts) |  |
| 본인 기기 웹 푸시 구독 해제 | DELETE | `/api/v1/notifications/push-subscriptions/{id}` | 연동 완료 | 알림 설정 푸시 (push.ts) |  |
| 본인 기기 웹 푸시 구독 목록 조회 | GET | `/api/v1/notifications/push-subscriptions` | 함수만 있음 | - | listPushSubscriptions |
| 웹 푸시 활성 상태 및 공개 VAPID 키 조회 | GET | `/api/v1/notifications/push-configuration` | 연동 완료 | 알림 설정 푸시 (push.ts) |  |

### 상품 조회

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 공개 상품 상세 조회 | GET | `/api/v1/products/{id}` | 연동 완료 | 상품 상세 /product/:id |  |
| 공개 상품 목록 및 검색 | GET | `/api/v1/products` | 연동 완료 | 홈, 판매 일정, 비슷한 상품 |  |

### 개인화 추천

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 구매자 GA 기반 관심 카테고리 프로필 조회 | GET | `/api/v1/ai/analytics/profile` | 미연동 | - | 함수 없음 |

### 판매 주문 관리

| API명 | 메서드 | URI | 상태 | 연결된 화면 | 비고 |
|---|---|---|---|---|---|
| 판매자 본인 주문 목록 조회 | GET | `/api/v1/seller/orders` | 연동 완료 | 판매자 주문 목록 /seller/orders |  |
| 판매자 본인 주문 상세 조회 | GET | `/api/v1/seller/orders/{id}` | 연동 완료 | 판매자 주문 상세 /seller/orders/:id |  |
