# 터널로 아이폰에서 테스트하기

Safari(iOS)는 **다른 사이트의 쿠키를 막는다**. 프론트(Vercel)에서 터널 주소를 직접 부르면 refresh 쿠키가 안 붙어 로그인이 안 된다.
그래서 앱은 **상대 경로만** 부르고(같은 origin), Vercel이 뒤에서 터널로 넘겨 준다.

```
브라우저(Safari)  ──/api/v1/…──────►  Vercel rewrite  ──►  https://GW_TUNNEL_HOST/api/v1/…   (Gateway :8000)
                 ──/pg/api/v1/…───►  Vercel rewrite  ──►  https://PG_TUNNEL_HOST/api/v1/…   (PurchaseGateway :8001, /pg는 뗀다)
```

- `/api/…` : 인증, 계정, 판매자 정보, 상품 조회, 주문 조회, 알림, AI, 결제 설정, 운영자 입점 심사
- `/pg/api/…` : 주문 생성, 결제, 체크아웃, 주문 문의 작성·답변, 판매자 상품 등록·관리, 운영자 상품 심사, 배송 처리
- **인증(CSRF·login·refresh·logout)은 반드시 `/api`.** refresh 쿠키 경로가 `/api/v1/auth`라서 `/pg`로 보내면 쿠키가 안 간다.
- 코드에서 주소는 `src/api/services.ts` 한 곳(`account`·`general` = `/api`, `purchase` = `/pg/api`)이다. 터널 주소는 코드에 없다.

## 1. 터널 주소 넣기 (주소가 바뀔 때마다 이 두 줄만)

`vercel.json`의 `destination` 두 줄에서 호스트만 바꾼다. `https://`는 이미 적혀 있고, 호스트에는 `https://`·끝 `/`를 넣지 않는다.

```json
{ "source": "/pg/:path*",  "destination": "https://PG_TUNNEL_HOST/:path*" },        ← PurchaseGateway(8001) 터널 호스트
{ "source": "/api/:path*", "destination": "https://GW_TUNNEL_HOST/api/:path*" },    ← Gateway(8000) 터널 호스트
```

예) Gateway 터널이 `https://abc-def.trycloudflare.com` 이면 `https://abc-def.trycloudflare.com/api/:path*`.

1. `feat/api-integration` 브랜치에서 위 두 줄을 고친다.
2. 커밋 후 push → Vercel이 이 브랜치 Preview를 자동으로 다시 배포한다.
3. **세 번째 줄(`/(.*)` → `/index.html`)은 항상 맨 아래.** API 두 줄이 위에 없으면 API 요청이 `index.html`을 받는다.
4. 터널을 다시 열면 주소가 바뀐다 → 1~2를 반복한다.

주의: 이 `vercel.json`이 `develop`/`main`에 합쳐지면 그 배포에도 같은 rewrite가 적용된다. mock 모드 화면은 `/api`를 부르지 않아 영향이 없지만, 실제 서버 주소가 정해지면 값을 교체한다.

## 2. Vercel에서 이 브랜치 Preview만 실제 API 모드로 (직접 설정)

앱은 기본으로 `VITE_DEMO_LOGIN`·`VITE_MOCK_AUTH`가 `true`면 mock 모드다(기존 Preview 유지용). **`VITE_USE_MOCK=false`를 명시하면 그 둘보다 우선해 실제 API 모드**가 된다.

1. Vercel 대시보드 → 이 프로젝트 → **Settings → Environment Variables**.
2. **Add New**: Key `VITE_USE_MOCK`, Value `false`.
3. Environments에서 **Preview만** 체크(Production·Development 해제). 그 아래 **Git Branch**(또는 "Select a custom Preview branch")에 `feat/api-integration` 입력.
4. **Save**. (이미 `VITE_USE_MOCK=true`가 Preview 전체에 있어도, 브랜치를 지정한 값이 그 브랜치에서 우선한다. 다른 브랜치 Preview는 그대로 mock.)
5. 환경 변수는 **새로 빌드해야** 적용된다(Vite가 빌드 때 넣는다). **Deployments** → `feat/api-integration`의 최신 배포 → **⋯ → Redeploy**. (또는 빈 커밋 push)
6. 확인: 배포된 주소의 로그인 화면에 **역할 선택(구매자·판매자·운영자) 데모 버튼이 없어야** 한다. 보이면 아직 mock이다(5단계 재배포 확인).
7. 서버가 연결됐는지: 브라우저에서 `https://<Preview 주소>/api/v1/auth/csrf`를 열면 JSON(`headerName`, `token`)이 와야 한다. HTML이 오면 rewrite 순서나 주소가 잘못된 것이다.

## 3. 이미지(S3 터널)

업로드·열람 URL은 서버 응답에 들어 있는 주소(S3 터널)를 **그대로** 쓴다(앱은 주소를 만들지 않는다). 업로드는 그 URL로 `PUT`, 권한 요청 때 보낸 것과 같은 `Content-Type`을 붙인다.
이 요청은 Vercel을 거치지 않고 브라우저가 S3 터널로 바로 보내므로, 서버 팀이 **S3 터널 CORS에 Preview 주소(origin)와 `PUT`·`Content-Type` 헤더를 허용**해야 한다.

## 4. 로컬 개발

`.env.local`:

```
VITE_API_TARGET=http://localhost:8000     # /api → Gateway (터널 https 주소도 가능)
VITE_PG_TARGET=http://localhost:8001      # /pg  → PurchaseGateway (/pg는 떼고 전달)
VITE_USE_MOCK=false                        # 실제 API. mock으로 보려면 true
```

터널 주소를 쓰면 `VITE_API_TARGET=https://<gw>`, `VITE_PG_TARGET=https://<pg>`로 바꾸고 dev 서버를 다시 띄운다.
iPhone 푸시·쿠키 확인은 HTTPS가 필요하므로 로컬이 아니라 Vercel Preview로 한다.

## 5. 터널 주소를 받으면 할 일 (순서)

1. `vercel.json`의 `GW_TUNNEL_HOST`(8000), `PG_TUNNEL_HOST`(8001)를 실제 호스트로 바꾼다. 9092(S3) 터널은 서버 팀이 `.env`에 넣는 값이라 프론트 파일은 없다.
2. 커밋·push → Preview 재배포를 기다린다.
3. Vercel 환경 변수 `VITE_USE_MOCK=false`(Preview, 브랜치 `feat/api-integration`)가 설정돼 있는지 확인(2절). 처음이면 설정 후 Redeploy.
4. `https://<Preview>/api/v1/auth/csrf`가 JSON인지 확인(2절 7번).
5. 서버 팀에 S3 터널 CORS(Preview origin, PUT, Content-Type) 확인을 요청한다.
6. `docs/api-check.md`의 "아이폰 확인 순서"를 따라 진행한다.
