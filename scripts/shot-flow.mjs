/**
 * 흐름별 스크린샷 도구
 * 사용법: node scripts/shot-flow.mjs <흐름번호>
 * 예시:   node scripts/shot-flow.mjs 01
 *
 * 출력: screenshots/flow-<N>/<이름>.png (390×844)
 * 사전 조건: Vite dev server가 http://localhost:5173 에서 실행 중이어야 함
 *   목업 계정 상태를 쓰므로 자동 로그인을 켠 dev 서버여야 함: VITE_MOCK_AUTH=true npm run dev
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:5173';
const VIEWPORT = { width: 390, height: 844 };

const flowNum = process.argv[2];
if (!flowNum) { console.error('흐름 번호를 입력하세요. 예: node scripts/shot-flow.mjs 01'); process.exit(1); }

// ── 상태 프리셋 ──────────────────────────────────────────────────────────────
function loggedOutState() {
  return {
    version: 1,
    auth: { userId: null, onboarded: false, challenges: {}, loginFailures: {} },
    activeUserId: '', mode: 'buyer',
    users: [], products: [], applications: [], holds: [], orders: [],
    inquiries: [], drafts: {}, addresses: {}, sellerSettings: {}, bookmarks: [],
    clockOffset: 0, paymentOutcome: 'success', aiOutcome: 'auto',
  };
}

function loggedInState(now) {
  const base = { sellerId: 'seller', shipping: 3000, maxPerAccount: 2, dispatchDays: 2, published: true, reason: '', startsAt: now - 2_400_000, endsAt: now + 8_400_000 };
  return {
    version: 1,
    auth: { userId: 'buyer', onboarded: true, challenges: {}, loginFailures: {} },
    activeUserId: 'buyer', mode: 'buyer',
    users: [
      { id: 'buyer', name: '김서윤', email: 'buyer@example.com', phone: '010-1234-5678', seller: false, admin: false },
      { id: 'seller', name: '김민지', email: 'seller@example.com', phone: '010-9876-5432', seller: true, admin: false },
    ],
    products: [
      { ...base, id: 'cardigan', name: '소프트 코튼 가디건', brand: 'OUI STUDIO', category: '의류 / 상의 / 가디건', price: 42000, images: ['./images/generated.png'], description: '', originalUrl: '', dimensions: [], options: [{ id: 'cs', name: '크림 / S', stock: 6 }, { id: 'cm', name: '크림 / M', stock: 8 }], extras: [], faqs: [] },
      { ...base, id: 'ecobag', endsAt: now + 2_520_000, name: '데일리 코튼 에코백', brand: '아틀리에 노트', category: '패션잡화 / 가방', price: 19000, images: ['./images/generated-4.png'], description: '', originalUrl: '', dimensions: [], options: [{ id: 'natural', name: '내추럴', stock: 12 }, { id: 'black', name: '블랙', stock: 8 }], extras: [], faqs: [] },
      { ...base, id: 'notebook', startsAt: now + 86_400_000, endsAt: now + 97_200_000, name: 'A5 데일리 노트', brand: '아틀리에 노트', category: '문구 / 노트', price: 6000, images: ['./images/generated-5.png'], description: '', originalUrl: '', dimensions: [], options: [{ id: 'plain', name: '무지 / 2권 세트', stock: 24 }], extras: [], faqs: [] },
      { ...base, id: 'basket', name: '모듈 수납 바구니', brand: '아틀리에 노트', category: '생활잡화 / 수납용품', price: 12000, images: ['./images/generated-3.png'], description: '', originalUrl: '', dimensions: [], options: [{ id: 'small', name: '소형 / 화이트', stock: 14 }], extras: [], faqs: [] },
    ],
    applications: [], holds: [], orders: [], inquiries: [], drafts: {}, addresses: {}, sellerSettings: {}, bookmarks: [], clockOffset: 0, paymentOutcome: 'success', aiOutcome: 'auto',
  };
}

function withChallenge(base, email, purpose, verified = false) {
  const now = Date.now();
  const key = `${purpose}:${email}`;
  return {
    ...base,
    auth: {
      ...(base.auth || {}),
      challenges: {
        [key]: {
          email, purpose, code: '', challengeId: 'mock-id',
          sentAt: now - 5_000,
          expiresAt: now + 175_000, // ~3분 남음
          attempts: 0,
          verified,
          ...(verified ? { token: 'mock-token' } : {}),
        },
      },
      loginFailures: {},
    },
  };
}

// ── 흐름별 화면 정의 ─────────────────────────────────────────────────────────
const FLOWS = {
  '01': (now) => [
    { name: '01-onboarding',         url: '/#/onboarding',                     state: loggedOutState() },
    { name: '02-welcome',            url: '/#/welcome',                         state: loggedOutState() },
    { name: '03-login',              url: '/#/login',                           state: loggedOutState() },
    { name: '04-signup',             url: '/#/signup',                          state: loggedOutState() },
    { name: '05-legal',              url: '/#/legal?kind=terms',               state: loggedOutState() },
    { name: '06-signup-verify',
      url: '/#/signup/verify?email=buyer%40example.com&name=%EA%B9%80%EC%84%9C%EC%9C%A4',
      state: withChallenge(loggedOutState(), 'buyer@example.com', 'signup') },
    { name: '07-signup-info',
      url: '/#/signup/info?email=buyer%40example.com&name=%EA%B9%80%EC%84%9C%EC%9C%A4',
      state: withChallenge(loggedOutState(), 'buyer@example.com', 'signup', true) },
    { name: '08-signup-done',        url: '/#/signup/done',                     state: loggedInState(now) },
    { name: '09-categories',         url: '/#/categories',                      state: loggedInState(now) },
    { name: '10-notifications',      url: '/#/notifications/settings',          state: loggedInState(now) },
    { name: '11-home',               url: '/#/',                                state: loggedInState(now) },
    { name: '12-reset-password',     url: '/#/reset-password',                  state: loggedOutState() },
    { name: '13-reset-code-sent',    url: '/#/reset-password',
      state: withChallenge(loggedOutState(), 'buyer@example.com', 'reset'),
      setup: async (page) => { await page.getByLabel('이메일').fill('buyer@example.com'); await page.waitForTimeout(400); } },
    { name: '14-reset-new-password',
      url: '/#/reset-password/new?email=buyer%40example.com',
      state: withChallenge(loggedOutState(), 'buyer@example.com', 'reset', true) },
  ],
  '07': (now) => {
    // 판매자 계정 + Figma 예시 값 초안/상품 (스크린샷 전용 상태, 앱 목업은 바꾸지 않음)
    const tue = new Date(now); tue.setHours(21, 0, 0, 0); do tue.setDate(tue.getDate() + 1); while (tue.getDay() !== 2);
    const local = (t) => new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const stock = { '차콜|S': 5, '차콜|M': 12, '차콜|L': 9, '차콜|XL': 4, '오트밀|S': 4, '오트밀|M': 8, '오트밀|L': 6, '오트밀|XL': 2 };
    const options = Object.entries(stock).map(([k, n]) => ({ id: 'opt-' + k, name: k.replace('|', ' / '), stock: n }));
    const reference = { platform: '쿠팡', title: '울 블렌드 오버핏 라운드 니트 차콜', price: 89000, image: './images/seller-register-3.jpg' };
    const result = { category: '니트/스웨터', path: '패션 › 상의 › 니트/스웨터', confidence: 96, photos: 2, found: [['색상', '차콜 그레이'], ['소재', '울 블렌드 (추정)'], ['핏', '오버핏 · 라운드넥'], ['시즌', '가을 · 겨울']], alternatives: [['패션 › 아우터 › 가디건', 12], ['패션 › 상의 › 맨투맨', 4]] };
    const knit = { name: '울 블렌드 오버핏 니트 (차콜)', images: ['./images/seller-register-1.jpg', './images/seller-register-2.jpg'], category: '패션 › 상의 › 니트/스웨터', originalUrl: 'coupang.com/vp/products/7348215906', price: 49000, dispatchDays: 2 };
    const draft = (ai) => ({ step: 1, brand: '', description: '', extras: [], reason: '', faqs: [], noOptions: false, shipping: 3000, maxPerAccount: 1, ...knit, startsAt: local(tue.getTime()), dimensions: [{ name: '색상', values: '차콜, 오트밀' }, { name: '사이즈', values: 'S, M, L, XL' }], options, axes: { size: true, color: true }, colors: ['차콜', '오트밀'], sizes: ['S', 'M', 'L', 'XL'], stock, reference, ai });
    const asSeller = (extra) => (s) => { s.activeUserId = 'seller'; s.auth.userId = 'seller'; s.mode = 'seller'; extra(s); return s; };
    const done = { status: 'recommended', signature: 'x', category: '', reason: '', result };
    return [
      { name: '01-register',         url: '/#/seller/new', full: true, prepare: asSeller(s => { s.drafts.seller = draft(done); }) },
      { name: '02-ai-result',        url: '/#/seller/new/ai', full: true, prepare: asSeller(s => { s.drafts.seller = draft(done); }) },
      { name: '03-ai-analyzing',     url: '/#/seller/new/ai/analyzing', prepare: asSeller(s => { s.drafts.seller = { ...draft({ status: 'analyzing', signature: 'x', category: '', reason: '' }), category: '' }; }) },
      { name: '04-ai-failed',        url: '/#/seller/new/ai/failed', prepare: asSeller(s => { s.drafts.seller = { ...draft({ status: 'failed', signature: 'x', category: '', reason: '' }), category: '' }; }) },
      { name: '05-edit',             url: '/#/seller/new?edit=notebook', full: true, prepare: asSeller(s => { const p = s.products.find(p => p.id === 'notebook'); Object.assign(p, knit, { startsAt: tue.getTime(), endsAt: tue.getTime() + 10800000, maxPerAccount: 1, notifySubscribers: 12, reference, dimensions: [{ name: '색상', values: '차콜, 오트밀' }, { name: '사이즈', values: 'S, M, L, XL' }], options }); delete s.drafts.seller; }) },
    ];
  },
  '02': (now) => {
    const at = (h, m) => { const t = new Date(now); t.setHours(h, m, 0, 0); return t; };
    return [
      { name: '01-schedule',          url: '/#/schedule',            clock: at(22, 8), state: null },
      { name: '02-sold-out',          url: '/#/product/basket',      clock: at(15, 0), state: null, full: true },
    ];
  },
  '03': () => [
    { name: '01-orders',              url: '/#/orders',              state: null, full: true },
  ],
  '06': (now) => {
    const at = (h, m) => { const t = new Date(now); t.setHours(h, m, 0, 0); return t; };
    return [
      { name: '01-seller-home',       url: '/#/',                    clock: at(15, 0), full: true, prepare: (s) => { s.activeUserId = 'seller'; s.auth.userId = 'seller'; return s; } },
      { name: '02-apply',             url: '/#/apply',               state: null, full: true },
    ];
  },
  '05': () => [
    { name: '01-order-inquiry',      url: '/#/orders/SD-2026-001/inquiry',      state: null },
  ],
  '04': (now) => [
    { name: '01-address-manage',     url: '/#/addresses',                       state: loggedInState(now) },
    { name: '02-address-edit',       url: '/#/addresses/addr-home/edit',        state: loggedInState(now) },
    { name: '03-address-new',        url: '/#/addresses/new',                   state: loggedInState(now) },
    { name: '04-address-search',     url: '/#/address-search',                  state: loggedInState(now) },
    { name: '05-address-search-empty', url: '/#/address-search',                state: loggedInState(now),
      setup: async (page) => { await page.getByLabel('주소 검색').first().fill('와우산로 9999'); await page.keyboard.press('Enter'); await page.waitForTimeout(3000); } },
  ],
};

// 세 번째 인자로 화면 이름 일부를 주면 그 화면만 찍는다. 예: node scripts/shot-flow.mjs 06 apply
const only = process.argv[3];
const screens = FLOWS[flowNum]?.(Date.now())?.filter(s => !only || s.name.includes(only));
if (!screens) { console.error(`흐름 ${flowNum}은 정의되지 않았습니다. 정의된 흐름: ${Object.keys(FLOWS).join(', ')}`); process.exit(1); }

const outDir = `screenshots/flow-${flowNum}`;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

for (const { name, url, state, setup, clock, prepare, full } of screens) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  // state: null → 앱 기본 목업(seedState) 사용. clock → 해당 시각으로 브라우저 시계 고정 후 진행
  if (clock) await page.clock.install({ time: clock });
  if (state) await page.addInitScript((s) => { localStorage.setItem('stockdrop:v1', JSON.stringify(s)); }, state);
  await page.goto(BASE + url);
  await page.waitForTimeout(1500);
  // prepare: 기본 목업을 한 번 저장한 뒤 그 상태를 고쳐서 다시 연다
  if (prepare) { const s = prepare(JSON.parse(await page.evaluate(() => localStorage.getItem('stockdrop:v1')))); await page.evaluate((v) => localStorage.setItem('stockdrop:v1', v), JSON.stringify(s)); await page.reload(); await page.waitForTimeout(1500); }
  if (setup) await setup(page);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: !!full });
  console.log(`✓ ${file}`);
  await ctx.close();
}

await browser.close();
console.log(`\n완료: ${screens.length}개 화면 → ${outDir}/`);
