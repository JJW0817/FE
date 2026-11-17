import { test, expect } from '@playwright/test';
import path from 'node:path';
import { blockExternal } from './session';

// 판매자 계정으로 기본 목업을 연 상태에서 시작한다
test.beforeEach(async ({ page }) => {
  await blockExternal(page);
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
  await expect(page.getByRole('heading', { name: 'AI 상품 분석' })).toBeHidden(); // 결과 화면이 사라진 뒤 폼의 카테고리를 확인
  await expect(page.getByText('패션 › 상의 › 니트/스웨터')).toBeVisible();
  // AI 질문 답은 FAQ로 공개되고, 분석 뒤에 정보가 바뀌면 질문을 다시 받아야 한다는 안내가 뜬다
  await expect(page.getByText('분석은 선택이라 건너뛰고')).toBeVisible(); await expect(page.getByText('상품 전체가 보이는 사진과 라벨')).toBeVisible();
  const aiAnswer = page.getByRole('textbox', { name: /AI 질문 답/ }); await expect(aiAnswer).toBeVisible(); await expect(page.getByText('이 답은 상품 FAQ로 구매자에게도 공개돼요')).toBeVisible();
  await aiAnswer.fill('총장 68cm, 가슴 단면 56cm');
  await page.getByLabel('상품명').fill('울 블렌드 오버핏 니트 (차콜) 수정'); await expect(page.getByText('정보가 바뀌어 AI 질문을 다시 받아야 해요')).toBeVisible(); await expect(aiAnswer).toHaveCount(0);
  await page.getByLabel('상품명').fill('울 블렌드 오버핏 니트 (차콜)'); await expect(page.getByText('정보가 바뀌어 AI 질문을 다시 받아야 해요')).toHaveCount(0); await expect(aiAnswer).toHaveValue('총장 68cm, 가슴 단면 56cm');

  await page.getByLabel('타 플랫폼 판매 URL').fill('coupang.com/vp/products/7348215906');
  await expect(page.getByText('http:// 또는 https://로 시작하는 주소를 입력해 주세요.')).toBeVisible();
  await page.getByLabel('타 플랫폼 판매 URL').fill('https://coupang.com/vp/products/7348215906');
  await expect(page.getByText('확인됨')).toBeVisible();
  // 원본 URL도 분석 입력이라, 분석 뒤에 채우면 이전 AI 질문은 쓸 수 없다 → 다시 분석(입력이 같으면 기존 결과)
  await expect(page.getByText('정보가 바뀌어 AI 질문을 다시 받아야 해요')).toBeVisible();
  await page.getByRole('button', { name: '다시 분석', exact: true }).click(); await expect(page.getByRole('heading', { name: 'AI 상품 분석' })).toBeVisible();
  await page.getByRole('button', { name: '이 카테고리로 적용' }).click(); await expect(page.getByText('정보가 바뀌어 AI 질문을 다시 받아야 해요')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: /AI 질문 답/ })).toHaveValue('총장 68cm, 가슴 단면 56cm');
  await page.getByLabel('한정 판매가').fill('49000');
  await expect(page.getByText('45% 저렴')).toBeVisible();

  await page.getByRole('button', { name: '색상', exact: true }).last().click();
  await page.getByLabel('색상', { exact: true }).fill('차콜'); await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '사이즈 추가' }).click();
  await page.getByLabel('사이즈 추가').fill('S'); await page.keyboard.press('Enter');
  for (let i = 0; i < 5; i++) await page.getByLabel('S 증가').click();
  await expect(page.getByText('50개')).toHaveCount(0);
  await expect(page.getByText('차콜 5')).toBeVisible();

  // 점검 기준 입력칸은 질문 문장이 아닌 고정 표시명, AI 질문은 같은 칸 옆에
  await expect(page.getByText('실측 사이즈(총장·가슴 단면)를 알려 주세요')).toBeVisible();
  await page.getByLabel('소재·혼용률', { exact: true }).fill('울 80%');
  // 택배사·반품·교환 배송비 → 배송 안내 글 자동 작성
  await page.getByLabel('택배사').selectOption('CJ대한통운'); await page.getByLabel('반품 배송비').fill('3000'); await page.getByLabel('교환 배송비').fill('6000');
  await expect(page.getByLabel('배송 안내')).toHaveValue('CJ대한통운 / 반품 배송비 3,000원 / 교환 배송비 6,000원');

  // 물품 검수: 모두 확인하지 않으면 심사 요청이 막힌다
  await page.getByRole('button', { name: '판매 심사 요청하기' }).click();
  await expect(page.getByText('물품 검수 항목을 모두 확인해 주세요.')).toBeVisible();
  for (const c of await page.getByRole('checkbox', { name: /새 상품이에요|구성품이 모두|사용한 흔적|사진이 지금/ }).all()) await c.check();
  await page.getByRole('button', { name: '판매 심사 요청하기' }).click();
  await expect(page.getByRole('heading', { name: '판매 심사 결과' })).toBeVisible();

  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('stockdrop:v1')!));
  const p = s.products.find((p: { name: string }) => p.name === '울 블렌드 오버핏 니트 (차콜)');
  expect(p.category).toBe('패션 › 상의 › 니트/스웨터');
  expect(p.brand).toBe('아틀리에 노트');
  expect(p.options).toEqual([expect.objectContaining({ name: '차콜 / S', stock: 5 })]);
  expect(p.faqs).toEqual([expect.objectContaining({ question: '실측 사이즈(총장·가슴 단면)를 알려 주세요', answer: '총장 68cm, 가슴 단면 56cm', suggestionId: 'mock-suggestion-1' })]); // AI 질문 답은 attributes가 아니라 FAQ로
  expect(p.extras).toEqual([{ key: '소재·혼용률', value: '울 80%' }]); // 카테고리별 입력칸은 그대로 attributes
  expect(p.shippingNotice).toBe('CJ대한통운 / 반품 배송비 3,000원 / 교환 배송비 6,000원');
});
