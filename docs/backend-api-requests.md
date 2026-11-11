# 백엔드 API 필드 요청

Figma Frame 2 화면에는 나오지만 현재 도메인(API 응답)에 없는 값입니다.
프런트에서는 타입에 **optional 필드**로 추가하고 목업에 Figma 예시 값을 넣었습니다. **값이 없으면 그 행은 화면에서 숨깁니다.**

## 요청 필드

| 화면 | 필드명 | 타입 | 예시 값 |
|---|---|---|---|
| 09 판매자 신청 심사 상세 | `Application.business.name` (상호) | `string?` | `나의 상점` |
| 09 판매자 신청 심사 상세 | `Application.business.representative` (대표자) | `string?` | `김서윤` |
| 09 판매자 신청 심사 상세 | `Application.business.registrationNumber` (등록번호) | `string?` | `214-86-12345` |
| 09 판매자 신청 심사 상세 | `Application.business.businessType` (업태 · 종목) | `string?` | `소매업 · 의류` |
| 09 판매자 신청 심사 상세 | `Application.business.openedAt` (개업연월일) | `string?` | `2023년 04월 12일` |
| 09 판매자 신청 심사 상세 | `Application.business.address` (사업장 소재지) | `string?` | `서울 성동구 성수이로 118` |
| 08 사업자 서류/담당자 정보 수정 | `SellerSettings.business.name` (상호) | `string?` | `로엠필드 (LOMFIELD)` |
| 08 사업자 서류/담당자 정보 수정 | `SellerSettings.business.registrationNumber` (사업자등록번호, 마스킹) | `string?` | `214-87-*****` |
| 08 사업자 서류/담당자 정보 수정 | `SellerSettings.business.representative` (대표자) | `string?` | `김서윤` |
| 08 사업자 서류/담당자 정보 수정 | `SellerSettings.business.businessType` (업태 · 종목) | `string?` | 화면 예시 없음 |
| 02 판매 종료(소진), 01 구매자 홈 / 06 판매자 홈 | `Product.soldOutAt` (선착순 마감 = 완판 시각, epoch ms) | `number?` | `21:37:19` 마감 / `23분 만에 완판됐어요` (startsAt 기준 경과) |
| 02 판매 종료(소진) | `Product.participants` (함께 도전한 인원) | `number?` | `894` → `894명` |
| 05 문의, 문의 상세 | `Inquiry.quantity` (문의한 주문 수량) | `number?` | `1` → `소프트 코튼 가디건 · 1개` |

- 사업자 정보는 사업자등록증 기준 값입니다. 판매자가 직접 입력하지 않으므로(입점 신청 화면 안내: "사업자명·등록번호는 별도로 입력하지 않습니다") 운영 심사 또는 OCR 결과로 채워 주는 형태를 가정합니다.
- 개업연월일·소재지는 요청 목록(상호·대표자·등록번호·업태) 외에 같은 사업자등록증 미리보기에 함께 나오는 값이라 같은 타입에 넣었습니다.
- 프런트 타입: `BusinessInfo { name?; representative?; registrationNumber?; businessType?; openedAt?; address? }` (`src/domain.ts`)

## 필수 여부 확인 필요

Figma `판매 상품 등록` 단일 화면에는 입력란이 없어 등록 화면에서 뺀 항목입니다. 지금은 빈 값으로 저장합니다. 백엔드에서 필수인지 확인해 주세요.

| 필드명 | 타입 | 현재 저장 값 | 비고 |
|---|---|---|---|
| `Product.description` (상품 설명) | `string` | `''` | 상품 상세 "상품 정보"에 표시 |
| `Product.extras` (추가 정보, 항목명 · 내용) | `{ key: string; value: string }[]` | `[]` | 상품 상세 정보 행 |
| `Product.reason` (재고 처분 사유) | `string` | `''` | 상품 상세 "재고 처분 사유" 행 |

- 예상 질문 FAQ(`Product.faqs`)는 등록 화면에서 **제외 확정**입니다. 새로 등록한 상품은 `[]`로 저장합니다.
- 브랜드(`Product.brand`)는 입력란 없이 판매자 정보(`sellerDisplayName`)에서 자동으로 채워 저장합니다.
- 카테고리는 Figma 체계(`패션 › 상의 › 니트/스웨터`)로 통일했습니다. 기존 `의류 / 상의 / 가디건` 형식은 제거했으므로 카테고리 값 형식을 맞춰 주세요.

## 화면 작업 중 추가로 필요해진 필드 (참고)

위 목록 외에 이번 작업에서 optional로 추가한 필드입니다. 함께 검토해 주세요.

| 화면 | 필드명 | 타입 | 예시 값 |
|---|---|---|---|
| 07 판매 정보 수정 | `Product.notifySubscribers` (판매 시작 알림 신청 인원) | `number?` | `12` → `알림 신청 12명` |
| 07 판매 상품 등록, 판매 정보 수정 | `Product.reference` / `Draft.reference` (타 플랫폼 판매 URL 확인 결과) | `{ platform: string; title: string; price: number; image?: string }?` | `{ platform: '쿠팡', title: '울 블렌드 오버핏 라운드 니트 차콜', price: 89000 }` → `45% 저렴 · 쿠팡 판매가보다 40,000원 저렴해요` |
| 07 AI 상품분석 | `Draft.ai.result` (AI 분석 결과) | `{ category; path; confidence; photos; found: [string, string][]; alternatives: [string, number][] }?` | `니트/스웨터`, `패션 › 상의 › 니트/스웨터`, `96%`, 색상 `차콜 그레이` … |
| 05 문의 | `Inquiry.images` (첨부 사진, 최대 5장) | `string[]?` | 첨부 파일 ID 목록 |
