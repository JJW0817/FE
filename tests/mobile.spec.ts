import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { actor, signInDemo } from './session';

/** 아이폰 14 크기(390x844)·작은 폰(360x740)에서 주요 화면이 화면 너비를 넘지 않는지 — 넘치면 사파리가 화면을 줄여 보여 토스트·고정 버튼 위치가 어긋난다 */
async function overflow(page: Page) {
  await page.waitForTimeout(500); // 진입 애니메이션이 끝난 뒤 잰다
  return page.evaluate(() => {
    const w = document.documentElement.clientWidth, offenders: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el); if (cs.position === 'fixed' && r.left >= 0 && r.right <= w + 1) continue;
      // 가로 스크롤 영역 안쪽은 의도된 넘침이라 제외
      let p = el.parentElement, scroller = false; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scroller = true; break; } p = p.parentElement; }
      if (!scroller && (r.right > w + 1 || r.left < -1)) offenders.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    }
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: w, offenders: offenders.slice(0, 8) };
  });
}
const screens: [string, string, string?][] = [['웰컴', '/#/welcome'], ['로그인', '/#/login'], ['회원가입', '/#/signup'], ['홈', '/#/'], ['상품 상세', '/#/product/ecobag'], ['마이페이지', '/#/my'], ['알림 설정', '/#/notifications/settings']];

for (const [width, height] of [[390, 844], [360, 740]]) {
  test.describe(`${width}x${height}`, () => {
    test.use({ viewport: { width, height } });
    test.beforeEach(async ({ page }) => { await signInDemo(page); });
    for (const [name, url] of screens) {
      test(`${name}: 가로 넘침 없음`, async ({ page }) => {
        if (name === '웰컴' || name === '로그인' || name === '회원가입') await actor(page, 'buyer').then(() => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('stockdrop:v1')!); s.auth.userId = null; s.activeUserId = ''; localStorage.setItem('stockdrop:v1', JSON.stringify(s)); }));
        await page.goto(url); await page.reload();
        const r = await overflow(page);
        expect(r.scrollWidth, JSON.stringify(r.offenders)).toBeLessThanOrEqual(r.clientWidth);
        expect(r.offenders, `${name} 화면 너비를 넘는 요소`).toEqual([]);
      });
    }
    test('결제: 가로 넘침 없음', async ({ page }) => {
      await page.goto('/#/product/ecobag'); await page.getByRole('button', { name: /남은.*선착순 구매하기/ }).click(); await page.getByRole('button', { name: '내추럴 수량 추가', exact: true }).click(); await page.getByRole('button', { name: '구매하기', exact: true }).click();
      await expect(page).toHaveURL(/checkout/);
      const r = await overflow(page);
      expect(r.scrollWidth, JSON.stringify(r.offenders)).toBeLessThanOrEqual(r.clientWidth);
      expect(r.offenders, '결제 화면 너비를 넘는 요소').toEqual([]);
    });
  });
}

test.describe('토스트·입력칸 (390x844)', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => { await signInDemo(page); });
  test('토스트는 좌우 16px 안쪽 가운데에 뜨고 하단 메뉴를 덮지 않는다', async ({ page }) => {
    await page.goto('/#/my'); await page.getByText('로그아웃').first().click(); await page.getByRole('button', { name: '로그아웃하기' }).click();
    const toast = page.getByRole('status').filter({ hasText: '로그아웃했습니다.' }); await expect(toast).toBeVisible();
    const b = (await toast.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(16); expect(b.x + b.width).toBeLessThanOrEqual(390 - 16);
    expect(Math.abs(b.x + b.width / 2 - 195)).toBeLessThan(2); // 가운데
    expect(b.y + b.height).toBeLessThan(844 - 66); // 하단 메뉴(약 66px) 위
  });
  test('입력칸 글자는 16px 이상(아이폰 자동 확대 방지)', async ({ page }) => {
    for (const url of ['/#/login', '/#/signup', '/#/seller/new', '/#/addresses/new', '/#/inquiries/compose']) {
      await page.goto(url); await page.waitForTimeout(300);
      const small = await page.evaluate(() => Array.from(document.querySelectorAll('input, textarea, select')).filter(e => !['checkbox', 'radio', 'range', 'file', 'hidden'].includes((e as HTMLInputElement).type) && parseFloat(getComputedStyle(e).fontSize) < 16).map(e => (e as HTMLElement).getAttribute('aria-label') ?? e.tagName));
      expect(small, `${url} 16px 미만 입력칸`).toEqual([]);
    }
  });
});
