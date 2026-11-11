import { test, expect } from '@playwright/test';
import path from 'node:path';
import { actor, editState, signInDemo } from './session';
test.beforeEach(async ({ page }) => { await signInDemo(page); });

test('외부 네트워크 없이 로컬 이미지와 폰트 로드', async ({ page }) => {
  await page.route('https://**/*', route => route.abort());
  await page.goto('/#/login');
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family); });
  expect(fonts.some(f => f.includes('Noto Sans KR'))).toBe(true);
  await page.goto('/#/product/ecobag');
  const photo = page.getByRole('img', { name: '데일리 코튼 에코백', exact: true }).first();
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await page.locator('link[rel="stylesheet"]').evaluateAll(nodes => nodes.every(n => new URL((n as HTMLLinkElement).href).origin === location.origin))).toBe(true);
});

test('추천 실패의 직접 선택과 지원 제외 상품 우회 차단', async ({ page }) => {
  await actor(page, 'seller'); await editState(page, s => { s.aiOutcome = 'failed'; });
  await page.goto('/#/seller/new'); await page.getByLabel('상품 사진 업로드').setInputFiles(path.resolve('public/images/generated-4.png')); await page.getByLabel('상품명').fill('코튼 에코백');
  await page.goto('/#/seller/new/ai/failed'); await expect(page.getByRole('heading', { name: /사진을 분석하지 못했어요/ })).toBeVisible(); await expect(page.getByRole('button', { name: '다시 분석' })).toBeVisible();
  await page.getByRole('button', { name: '직접 입력하기' }).click(); await expect(page.getByRole('dialog', { name: '카테고리 선택' })).toBeVisible(); await expect(page.getByRole('radio', { name: /화장품/ })).toHaveCount(0); await page.getByRole('radio', { name: '패션 › 잡화 › 가방' }).check(); await page.getByRole('button', { name: '카테고리 저장' }).click(); await expect(page.getByRole('dialog', { name: '카테고리 선택' })).toHaveCount(0); await expect(page.getByText('패션 › 잡화 › 가방')).toBeVisible();
  await page.getByLabel('상품명').fill('비타민 건강기능식품'); await expect(page.getByText(/지원하지 않는 상품은 등록할 수 없습니/).first()).toBeVisible();
});

test('주요 화면 360px·1440px 반응형과 런타임 오류 검수', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of ['/#/', '/#/product/ecobag', '/#/schedule', '/#/orders', '/#/my', '/#/apply']) { await page.goto(url); await expect(page.locator('main')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
    await actor(page, 'seller');
    for (const url of ['/#/seller', '/#/seller/products', '/#/seller/new', '/#/seller/my', '/#/seller/settings/business', '/#/seller/settings/addresses', '/#/seller/orders', '/#/seller/inquiries']) { await page.goto(url); await expect(page.locator('main')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); }
    await actor(page, 'buyer');
  }
  expect(errors).toEqual([]);
});
