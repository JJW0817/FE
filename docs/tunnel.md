# 서버 주소와 Vercel 미리보기 (고정 도메인)

Safari(iOS)는 **다른 사이트의 쿠키를 막는다**. 프론트(Vercel)에서 서버 주소를 직접 부르면 refresh 쿠키가 안 붙어 로그인이 안 된다.
그래서 앱은 **상대 경로만** 부르고(같은 origin), Vercel이 뒤에서 서버로 넘겨 준다.

```
브라우저(Safari)  ──/api/v1/…──────►  Vercel rewrite  ──►  https://api.stockdrop.cloud/api/v1/…   (Gateway)
                 ──/pg/api/v1/…───►  Vercel rewrite  ──►  https://pay.stockdrop.cloud/api/v1/…   (PurchaseGateway, /pg는 뗀다)
```

- `/api/…` : 인증, 계정, 판매자 정보, 상품 조회, 주문 조회, 알림, AI, 결제 설정, 운영자 입점 심사
- `/pg/api/…` : 주문 생성, 결제, 체크아웃, 주문 문의 작성·답변, 판매자 상품 등록·관리, 운영자 상품 심사, 배송 처리
- **인증(CSRF·login·refresh·logout)은 반드시 `/api`.** refresh 쿠키 경로가 `/api/v1/auth`라서 `/pg`로 보내면 쿠키가 안 간다.
- 코드에서 주소는 `src/api/services.ts` 한 곳(`account`·`general` = `/api`, `purchase` = `/pg/api`)이다. 서버 주소는 코드에 없다(`vercel.json`·`.env.local`에만 있다).

## 1. 현재 주소 (고정 도메인)

| 용도 | 주소 | 어디에 쓰나 |
|---|---|---|
| 일반 API (Gateway) | `https://api.stockdrop.cloud` | `vercel.json` `/api/:path*` → `https://api.stockdrop.cloud/api/:path*`, 로컬 `VITE_API_TARGET` |
| 구매·결제 API (PurchaseGateway) | `https://pay.stockdrop.cloud` | `vercel.json` `/pg/:path*` → `https://pay.stockdrop.cloud/:path*`, 로컬 `VITE_PG_TARGET` |
| 이미지 | `https://img.stockdrop.cloud` | 업로드·열람 URL은 서버 응답에 들어 있다(앱은 주소를 만들지 않는다) |

`vercel.json`의 순서는 항상 `/pg` → `/api` → `/(.*)`(index.html). API 두 줄이 위에 없으면 API 요청이 `index.html`을 받는다.
주소가 또 바뀌면 `vercel.json` 두 줄과 아래 로컬 `.env.local` 두 값만 고치고, 이 표도 같이 고친다.

주의: 이 `vercel.json`이 `develop`/`main`에 합쳐지면 그 배포에도 같은 rewrite가 적용된다. mock 모드 화면은 `/api`를 부르지 않아 영향이 없다.

## 2. Vercel에서 이 브랜치 Preview만 실제 API 모드로 (직접 설정)

앱은 기본으로 `VITE_DEMO_LOGIN`·`VITE_MOCK_AUTH`가 `true`면 mock 모드다(기존 Preview 유지용). **`VITE_USE_MOCK=false`를 명시하면 그 둘보다 우선해 실제 API 모드**가 된다.

1. Vercel 대시보드 → 이 프로젝트 → **Settings → Environment Variables**.
2. **Add New**: Key `VITE_USE_MOCK`, Value `false`.
3. Environments에서 **Preview만** 체크(Production·Development 해제). 그 아래 **Git Branch**(또는 "Select a custom Preview branch")에 `feat/api-integration` 입력.
4. **Save**. (이미 `VITE_USE_MOCK=true`가 Preview 전체에 있어도, 브랜치를 지정한 값이 그 브랜치에서 우선한다. 다른 브랜치 Preview는 그대로 mock.)
5. 환경 변수는 **새로 빌드해야** 적용된다(Vite가 빌드 때 넣는다). **Deployments** → `feat/api-integration`의 최신 배포 → **⋯ → Redeploy**. (또는 빈 커밋 push)
6. 확인: 배포된 주소의 로그인 화면에 **역할 선택(구매자·판매자·운영자) 데모 버튼이 없어야** 한다. 보이면 아직 mock이다(5단계 재배포 확인).
7. 서버가 연결됐는지: 브라우저에서 `https://<Preview 주소>/api/v1/auth/csrf`를 열면 JSON(`headerName`, `token`)이 와야 한다. HTML이 오면 rewrite 순서나 주소가 잘못된 것이다.

## 3. 이미지

업로드·열람 URL(`https://img.stockdrop.cloud/…`)은 서버 응답에 들어 있는 주소를 **그대로** 쓴다. 업로드는 그 URL로 `PUT`, 권한 요청 때 보낸 것과 같은 `Content-Type`을 붙인다.
이 요청은 Vercel을 거치지 않고 브라우저가 이미지 서버로 바로 보내므로, 서버 팀이 **CORS에 Preview 주소(origin)와 `PUT`·`Content-Type` 헤더를 허용**해야 한다. (앱 코드에는 이미지 주소 허용 목록이 없다.)

## 4. 로컬 개발

`.env.local`:

```
VITE_API_TARGET=https://api.stockdrop.cloud   # /api → Gateway
VITE_PG_TARGET=https://pay.stockdrop.cloud    # /pg  → PurchaseGateway (/pg는 떼고 전달)
VITE_USE_MOCK=false                        # 실제 API. mock으로 보려면 true
```

값을 바꾸면 dev 서버를 다시 띄운다. 서버를 내 PC에서 직접 돌릴 때는 `http://localhost:8000` / `http://localhost:8001`.
iPhone 푸시·쿠키 확인은 HTTPS가 필요하므로 로컬이 아니라 Vercel Preview로 한다.

## 5. 고정 주소(stockdrop-app.vercel.app)로 Preview 연결하기

Preview는 배포마다 주소(`fe-xxxx-jjw0817.vercel.app`)가 바뀐다. 아이폰·팀 확인에는 고정 별칭 `stockdrop-app.vercel.app`을 쓰고, **재배포할 때마다 새 배포에 다시 연결**해야 한다.

```bash
# 1) Preview 배포 (--prod 쓰지 않는다). 마지막 줄의 주소가 새 배포 주소
npx vercel deploy --yes
# 2) 별칭을 새 배포로 옮긴다
npx vercel alias set <새 배포 주소> stockdrop-app.vercel.app
# 3) 확인: 별칭이 새 배포를 가리키는지
npx vercel alias ls
```

- 대시보드에서 Redeploy를 했다면 1)은 건너뛰고 새 배포 주소만 2)에 넣는다.
- `VITE_USE_MOCK=false`는 빌드 때 적용되므로 환경 변수를 바꾼 뒤에는 반드시 새로 배포(Redeploy)해야 한다.
- 연결 후 `https://stockdrop-app.vercel.app/#/login`에서 역할 선택(구매자/판매자/운영자) 버튼이 없고 이메일·비밀번호 입력만 보이면 실제 서버 모드다.
