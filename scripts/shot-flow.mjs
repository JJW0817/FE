/**
 * 흐름별 스크린샷 도구
 * 사용법: node scripts/shot-flow.mjs <흐름번호>
 * 예시:   node scripts/shot-flow.mjs 01
 *
 * 출력: screenshots/flow-<N>/<이름>.png (390×844)
 * 사전 조건: Vite dev server가 http://localhost:5173 에서 실행 중이어야 함
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
    { name: '06-signup-code-sent',   url: '/#/signup',
      state: withChallenge(loggedOutState(), 'buyer@example.com', 'signup'),
      setup: async (page) => { await page.getByLabel('이메일').fill('buyer@example.com'); await page.waitForTimeout(400); } },
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
};

const screens = FLOWS[flowNum]?.(Date.now());
if (!screens) { console.error(`흐름 ${flowNum}은 정의되지 않았습니다. 정의된 흐름: ${Object.keys(FLOWS).join(', ')}`); process.exit(1); }

const outDir = `screenshots/flow-${flowNum}`;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

for (const { name, url, state, setup } of screens) {
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  const page = await ctx.newPage();
  await page.addInitScript((s) => { localStorage.setItem('stockdrop:v1', JSON.stringify(s)); }, state);
  await page.goto(BASE + url);
  await page.waitForTimeout(1500);
  if (setup) await setup(page);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`✓ ${file}`);
  await ctx.close();
}

await browser.close();
console.log(`\n완료: ${screens.length}개 화면 → ${outDir}/`);
