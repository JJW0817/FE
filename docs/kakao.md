# 카카오 키 (현재 위치로 주소 찾기)

주소 검색 화면의 **현재 위치로 주소 찾기**는 브라우저 위치(`navigator.geolocation`) → 카카오 지도 JS SDK `services.Geocoder.coord2Address`로 도로명·지번·우편번호를 받는다.
명세(`docs/api-spec.md`)에 좌표→주소 API가 없어서 카카오를 직접 쓴다. 코드는 `src/geo.ts`.

우편번호 검색(주소 검색)은 키가 필요 없다(`https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js`).

## 1. 키 발급

1. https://developers.kakao.com → 로그인 → **내 애플리케이션 → 애플리케이션 추가하기**.
2. 앱을 만든 뒤 **앱 설정 → 앱 키**에서 **JavaScript 키**를 복사한다 (REST API 키 아님).
3. **제품 설정 → 카카오맵**에서 사용 설정을 **ON**으로 바꾼다 (꺼져 있으면 SDK가 거절한다).

## 2. 도메인 등록

**앱 설정 → 플랫폼 → Web → 사이트 도메인**에 주소를 하나씩 추가한다. 등록하지 않은 주소에서는 SDK가 401로 실패한다.

- `http://localhost:5173` (로컬 dev)
- Vercel Preview·Production 주소 (예: `https://<프로젝트>-git-feat-api-integration-<팀>.vercel.app`)

## 3. 키 넣기

- 로컬: `.env.local`에 `VITE_KAKAO_JS_KEY=<JavaScript 키>` → dev 서버 재시작.
- Vercel: **Settings → Environment Variables**에 `VITE_KAKAO_JS_KEY` 추가 → 재배포(Vite가 빌드 때 넣는다).

JavaScript 키는 브라우저에 노출되는 키다. 대신 위 도메인 등록으로 다른 사이트에서 못 쓰게 막는다.

## 제한·동작

- **https(또는 localhost)에서만** 위치를 쓸 수 있다. `http://172.x.x.x:5173`처럼 LAN IP로 휴대폰에서 열면 "https 주소에서만" 안내가 뜬다 → Vercel Preview로 확인.
- 권한 거부·시간 초과(10초)·위치 없음은 화면에 안내하고 주소 검색을 쓰게 한다.
- 결과는 폼에 채우고 **상세 주소 칸에 포커스**만 한다. 저장은 사용자가 누른다.
- 도로명이 없는 위치는 지번을 기본 주소로 넣고 우편번호는 비운다(지번은 상세 주소 위에 참고로 보인다. 배송지 API에 지번 필드는 없다).
- mock 모드는 네트워크 없이 고정 주소(서울 중구 세종대로 110, 04524)를 채운다.
