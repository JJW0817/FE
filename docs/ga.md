# GA4 맞춤 추천 연동

회원이 자주 본 카테고리의 새 상품을 웹 푸시로 알리기 위해 GA4에 **가명 ID(user_id)** 와 **상품 상세 조회(view_item)** 를 보낸다. 백엔드가 BigQuery로 하루 한 번 집계한다. 코드는 `src/analytics.ts`.

## 보내는 것
| 시점 | GA 호출 |
|---|---|
| 앱 시작 | `consent default` 전부 denied → `config`(자동 page_view 끔) |
| 로그인 직후 · 로그인 상태로 앱 시작 | `GET /api/v1/ai/analytics/identity` → 참여 중이면 `consent update granted` + `config user_id=가명ID`, 404(미참여)면 denied·user_id=null |
| 알림 설정에서 분석 토글 ON | `POST …/identity {analyticsConsent:true}` → 위와 같이 적용 |
| 알림 설정에서 분석 토글 OFF | `DELETE …/identity` → denied·user_id=null |
| 로그아웃 | denied·user_id=null만 (철회 API 안 부름) |
| 상품 상세 응답을 받은 뒤 1회 | `view_item` — `item_id`=상품 ID, `item_name`, `item_category`=서버 category 원문, `price`, `currency=KRW`, `value`=가격 |

- 가명 ID는 저장하지 않는다. 로그인할 때마다 서버에서 다시 받는다.
- `VITE_GA_ID`가 없으면(로컬) API 호출만 하고 gtag 호출은 모두 건너뛴다. mock 모드에서는 API도 view_item도 보내지 않는다.
- 이메일·계정 ID·JWT는 GA로 보내지 않는다.
- 동의 토글 위치: 회원가입 2단계 「알림 설정」과 마이페이지 → 알림 설정 (같은 화면). 기본 꺼짐, 화면을 열 때 서버 값(identity 등록 여부, 맞춤 추천 알림·마케팅 수신 동의)으로 표시한다. 맞춤 알림은 **분석 동의 + 마케팅 수신 동의가 모두** 있어야 받는다.

## 확인 방법 (실제 서버에 붙은 환경, 구매자 계정)
1. 알림 설정에서 「관심 상품 알림을 위한 조회 기록 분석」을 켠다(마케팅 수신 동의, 맞춤 상품 추천도 켠다).
2. **Tag Assistant**(tagassistant.google.com)에 사이트 주소를 넣어 연결한다. Consent 탭에서 `analytics_storage`가 `granted`로 바뀌는지 본다(토글 전에는 denied).
3. 상품 상세 화면을 연다.
4. **GA → 관리 → DebugView**에서 `view_item` 이벤트를 열어 확인한다.
   - 매개변수 `items[0].item_id` = 상품 ID
   - `items[0].item_category` = 상세 응답의 category 그대로 (예 `반팔 티셔츠`)
   - 사용자 속성 `user_id` = 가명 ID (토글 전·로그아웃 후에는 없음)
5. 로그아웃 후 상품을 열면 `user_id`가 없어야 한다. 토글을 끄면 DELETE 호출 후 `analytics_storage`가 denied가 된다.
6. **다음 날** `GET /api/v1/ai/analytics/profile`(로그인 후 개발자 도구 또는 서버 담당에게 요청)의 `analyticsEnabled=true`, `categoryName`, `views`가 위에서 본 카테고리·횟수와 맞는지 확인한다. 집계는 실시간이 아니다.

DebugView에 안 보이면: Tag Assistant로 디버그 모드가 켜졌는지, 광고 차단 확장이 없는지, 배포 환경에 `VITE_GA_ID`가 있는지부터 본다.
