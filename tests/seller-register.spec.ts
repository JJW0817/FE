import { test, expect } from '@playwright/test';
import path from 'node:path';

// 판매자 계정으로 기본 목업을 연 상태에서 시작한다
test.beforeEach(async ({ page }) => {
  await page.goto('/#/');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('stockdrop:v1')!);
    s.activeUserId = 'seller'; s.auth.userId = 'seller'; s.auth.onboarded = true; s.aiOutcome = 'auto'; delete s.drafts.seller;
    localStorage.setItem('stockdrop:v1', JSON.stringify(s));
  });
});

test('판매 상품 등록 단일 화면 → AI 분석 적용 → 판매 심사 요청 → 심사 대기', async ({ page }) => {
  await page.goto('/#/seller/new'); await page.reload();
  await expect(page.getByRole('heading', { name: '한정 판매 등록' })).toBeVisible();

  const images = ['seller-register-1.jpg', 'seller-register-2.jpg'].map(f => path.join(process.cwd(), 'public/images', f));
  await page.getByLabel('상품 사진 업로드').setInputFiles(images);
  await expect(page.getByText('2/10')).toBeVisible();
  await page.getByLabel('상품명').fill('울 블렌드 오버핏 니트 (차콜)');

  // 설명·처분 사유가 비어 있으면 AI 분석 버튼이 빠진 칸을 알려 준다
  await page.getByRole('button', { name: 'AI로 카테고리 분석하기' }).click();
  await expect(page.getByText('짧은 설명을 입력해 주세요.')).toBeVisible();
  await expect(page.getByText('처분 사유를 입력해 주세요.')).toBeVisible();
  await page.getByLabel('짧은 설명').fill('새 상품, 택 그대로');
  await page.getByLabel('처분 사유').fill('시즌 종료 후 남은 재고');
  await page.getByRole('button', { name: 'AI로 카테고리 분석하기' }).click();
  await expect(page.getByRole('heading', { name: 'AI 상품 분석' })).toBeVisible();
  await page.getByRole('button', { name: '이 카테고리로 적용' }).click();
  await expect(page.getByText('패션 › 상의 › 니트/스웨터')).toBeVisible();

  await page.getByLabel('타 플랫폼 판매 URL').fill('coupang.com/vp/products/7348215906');
  await expect(page.getByText('확인됨')).toBeVisible();
  await page.getByLabel('한정 판매가').fill('49000');
  await expect(page.getByText('45% 저렴')).toBeVisible();

  await page.getByRole('button', { name: '색상', exact: true }).last().click();
  await page.getByLabel('색상', { exact: true }).fill('차콜'); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '사이즈 추가' }).click();
  await page.getByLabel('사이즈 추가').fill('S'); await page.keyboard.press('Enter');
  for (let i = 0; i < 5; i++) await page.getByLabel('S 증가').click();
  await expect(page.getByText('50개')).toHaveCount(0);
  await expect(page.getByText('차콜 5')).toBeVisible();

  await page.getByRole('button', { name: '판매 심사 요청하기' }).click();
  await expect(page.getByRole('heading', { name: '심사 요청 결과' })).toBeVisible();

  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('stockdrop:v1')!));
  const p = s.products.find((p: { name: string }) => p.name === '울 블렌드 오버핏 니트 (차콜)');
  expect(p.category).toBe('패션 › 상의 › 니트/스웨터');
  expect(p.brand).toBe('아틀리에 노트');
  expect(p.options).toEqual([expect.objectContaining({ name: '차콜 / S', stock: 5 })]);
  expect(p.faqs).toEqual([]);
});
