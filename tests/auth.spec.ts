import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { editState } from './session';
// 회원가입·인증번호·비밀번호 재설정·실서버 로그인은 백엔드 API 연결 후 검증한다. 지금은 API 호출 직전 단계와 데모 계정 로그인만 확인
async function loggedOut(page: Page, onboarded = false) { await page.goto('/#/welcome'); await page.waitForFunction(() => !!localStorage.getItem('stockdrop:v1')); await editState(page, (s, onboarded) => { s.auth = { ...s.auth, userId: null, onboarded, demo: false }; s.activeUserId = ''; s.mode = 'buyer'; }, onboarded); await page.evaluate(() => sessionStorage.clear()); }
async function signIn(page: Page, email: string, password: string) { await page.getByLabel('이메일', { exact: true }).fill(email); await page.getByLabel('비밀번호', { exact: true }).fill(password); await page.getByRole('button', { name: '로그인', exact: true }).click(); }

test('첫 방문 온보딩 3단계·게스트 탐색·재방문 유지·구매 로그인 복귀', async ({ page }) => {
  await loggedOut(page); await page.goto('/'); await expect(page).toHaveURL(/onboarding/); await expect(page.getByRole('heading', { name: /남은 새 상품/ })).toBeVisible(); await page.getByRole('button', { name: '다음', exact: true }).click(); await expect(page.getByRole('heading', { name: /기회는 짧게/ })).toBeVisible(); await page.getByRole('button', { name: '다음', exact: true }).click(); await page.getByRole('button', { name: '시작하기' }).click(); await page.getByRole('button', { name: '가입 없이 둘러보기' }).click(); await page.reload(); await expect(page).toHaveURL(/#\/$/);
  await page.goto('/#/product/ecobag'); await page.getByRole('button', { name: /선착순 구매하기/ }).click(); await expect(page).toHaveURL(/login\?next/); await signIn(page, 'buyer@example.com', 'Stockdrop123!'); await expect(page).toHaveURL(/#\/product\/ecobag$/); await page.reload(); await page.getByRole('button', { name: /선착순 구매하기/ }).click(); await expect(page.getByRole('dialog', { name: '옵션 선택' })).toBeVisible();
});

test('회원가입: 이름과 올바른 이메일이 있어야 인증번호를 요청할 수 있다', async ({ page }) => {
  await loggedOut(page, true); await page.goto('/#/signup'); const request = page.getByRole('button', { name: '인증번호 요청', exact: true });
  await page.getByLabel('이메일', { exact: true }).fill('newcustomer@example.com'); await expect(request).toBeDisabled();
  await page.getByLabel('이름', { exact: true }).fill('한새봄'); await page.getByLabel('이메일', { exact: true }).fill('not-an-email'); await expect(request).toBeDisabled();
  await page.getByLabel('이메일', { exact: true }).fill('newcustomer@example.com'); await expect(request).toBeEnabled();
});

test('비밀번호 재설정은 이메일 인증 전에는 변경할 수 없다', async ({ page }) => {
  await loggedOut(page, true); await page.goto('/#/reset-password'); await expect(page.getByRole('button', { name: '비밀번호 변경하기' })).toBeDisabled();
  await page.getByLabel('이메일', { exact: true }).fill('buyer@example.com'); await expect(page.getByRole('button', { name: '인증번호 요청', exact: true })).toBeEnabled();
});

test('로그인 전 비공개 화면 접근 차단과 데모 계정 로그인 복귀', async ({ page }) => {
  await loggedOut(page, true); await page.goto('/#/my'); await expect(page).toHaveURL(/login\?next/); await expect(page.locator('main').getByText('김서윤')).toHaveCount(0);
  await signIn(page, 'buyer@example.com', 'Wrong123!'); await expect(page.getByRole('alert')).toContainText('확인해 주세요'); await expect(page).toHaveURL(/login\?next/);
  await signIn(page, 'buyer@example.com', 'Stockdrop123!'); await expect(page).toHaveURL(/#\/my$/); await expect(page.getByRole('heading', { name: '김서윤' })).toBeVisible();
});

test('인증 화면 360px·1440px 반응형과 상태바 없음', async ({ page }) => { await loggedOut(page, true); for (const width of [360, 1440]) { await page.setViewportSize({ width, height: 900 }); for (const url of ['/onboarding', '/welcome', '/login', '/signup', '/reset-password', '/legal?kind=privacy']) { await page.goto(`/#${url}`); await expect(page.locator('main')).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await expect(page.locator('.lucide-battery-full,.lucide-signal,.lucide-wifi')).toHaveCount(0); } } });
