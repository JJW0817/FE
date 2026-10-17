import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { signInDemo } from './session';
async function tool(page: Page, label: string, value?: string) { const summary = page.getByText('로컬 미리보기 · 실제 결제 없음'); const select = page.locator(`[aria-label="${label}"]:visible`); if (!await select.count()) await summary.click(); if (value) await page.locator(`[aria-label="${label}"]:visible`).selectOption(value); }
async function closeTools(page: Page) { const details = page.locator('details').filter({ has: page.getByText('로컬 미리보기 · 실제 결제 없음') }); if (await details.getAttribute('open') !== null) await page.getByText('로컬 미리보기 · 실제 결제 없음').click(); }
async function actor(page: Page, id: string) { await tool(page, '미리보기 사용자', id); await closeTools(page); }
async function reserveBag(page: Page) { await page.goto('/#/product/ecobag'); await page.getByRole('button', { name: /남은.*선착순 구매하기/ }).click(); await page.getByRole('button', { name: '내추럴 수량 추가', exact: true }).click(); await page.getByRole('button', { name: '블랙 수량 추가', exact: true }).click(); await page.getByRole('button', { name: '구매하기 · 5분 재고 확보', exact: true }).click(); await expect(page).toHaveURL(/checkout/); }
async function agreeAndPay(page: Page) { await page.getByRole('checkbox', { name: /주문 내용과 판매조건/ }).check(); await page.getByRole('button', { name: /안에 결제하기/ }).click(); }
async function state(page: Page) { return page.evaluate(() => JSON.parse(localStorage.getItem('stockdrop:v1')!)); }
function pdfBuffer() { return Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF'); }

test.beforeEach(async ({ page }) => { await signInDemo(page); });

test('홈 검색·카테고리 필터·외부 상품 새 탭 열기', async ({ page }) => {
  await page.getByRole('button', { name: '문구', exact: true }).click(); await expect(page.getByRole('heading', { name: 'A5 데일리 노트' })).toBeVisible(); await expect(page.getByRole('heading', { name: '모듈 수납 바구니' })).toHaveCount(0);
  await page.getByLabel('상품 검색').fill('검색되지않는상품'); await expect(page.getByText('검색 결과가 없어요')).toBeVisible(); await page.getByRole('button', { name: '필터 초기화' }).click();
  await page.goto('/#/product/ecobag'); const popupPromise = page.waitForEvent('popup'); await page.getByRole('link', { name: /기존 판매처에서 상품 보기/ }).click(); const popup = await popupPromise; await expect(popup.getByRole('heading', { name: '데일리 코튼 에코백' })).toBeVisible(); await popup.close(); await expect(page).toHaveURL(/product\/ecobag/);
  await page.goto('/#/product/notebook'); await expect(page.getByRole('button', { name: '판매 시작 전 · 구매할 수 없어요' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('재고 확보·새로고침·결제·판매자 출고·배송완료가 같은 주문으로 연결', async ({ page }) => {
  await reserveBag(page); const before = (await state(page)).holds[0].expiresAt; await page.reload(); expect((await state(page)).holds[0].expiresAt).toBe(before);
  await expect(page.getByText('41,000원', { exact: true })).toBeVisible(); await agreeAndPay(page); await expect(page.getByRole('heading', { name: '주문이 완료됐어요.' })).toBeVisible();
  const order = (await state(page)).orders.find((o: any) => o.productId === 'ecobag'); expect(order.lines.map((l: any) => l.name)).toEqual(['내추럴', '블랙']);
  await actor(page, 'seller'); await page.goto(`/#/seller/orders/${order.id}`); await page.getByLabel('운송장 번호', { exact: true }).fill('789456123000'); await page.getByRole('button', { name: '운송장 등록하고 배송 중으로 변경' }).click(); await page.getByRole('button', { name: '배송완료 처리', exact: true }).click();
  await expect(page.getByRole('button', { name: '배송완료 확정' })).toBeDisabled(); await page.getByRole('checkbox', { name: '실제 배송완료 확인' }).check(); await page.getByRole('button', { name: '배송완료 확정' }).click(); await expect(page.getByRole('button', { name: '배송완료 처리됨' })).toBeVisible();
  await actor(page, 'buyer'); await page.goto(`/#/orders/${order.id}`); await expect(page.getByRole('heading', { name: '상품 배송이 완료되었어요' })).toBeVisible(); await expect(page.getByText(/판매자 수동 처리 ·/)).toBeVisible(); await page.reload(); expect((await state(page)).orders.find((o: any) => o.id === order.id).status).toBe('delivered');
});

test('결제 결과 확인 중에는 5분이 지나도 재고가 반환되지 않고 승인 후 한 번만 확정', async ({ page }) => {
  await tool(page, '결제 목업 응답', 'pending'); await closeTools(page); await reserveBag(page); await agreeAndPay(page); await expect(page.getByRole('button', { name: '결제 결과 다시 확인' })).toBeVisible();
  await tool(page, '결제 목업 응답'); await page.getByRole('button', { name: '+5분 진행' }).filter({ visible: true }).click(); await closeTools(page); await page.waitForTimeout(1200); expect((await state(page)).holds[0].status).toBe('pending');
  await tool(page, '결제 목업 응답', 'success'); await closeTools(page); await page.getByRole('button', { name: '결제 결과 다시 확인' }).click(); await expect(page.getByText('주문이 완료됐어요.')).toBeVisible(); expect((await state(page)).orders.filter((o: any) => o.productId === 'ecobag')).toHaveLength(1);
});

test('5분 만료와 새로고침 시 재고 확보 시간 연장 방지', async ({ page }) => {
  await reserveBag(page); await tool(page, '결제 목업 응답'); await page.getByRole('button', { name: '+5분 진행' }).filter({ visible: true }).click(); await closeTools(page); await expect(page.getByText('확보 시간이 만료되었어요')).toBeVisible(); await page.reload(); await expect(page.getByRole('link', { name: '상품으로 돌아가기' })).toBeVisible(); await expect(page.getByRole('button', { name: /안에 결제하기/ })).toHaveCount(0);
});

test('사업자 PDF 신청 후 운영자 승인 시 기존 구매 권한과 주문이 유지', async ({ page }) => {
  await page.goto('/#/apply'); await expect(page.getByLabel('쇼핑몰 URL')).toHaveCount(0); await expect(page.getByRole('button', { name: '입점 심사 요청하기' })).toBeDisabled();
  await page.getByLabel('사업자등록증 PDF 첨부').setInputFiles({ name: '사업자등록증.pdf', mimeType: 'application/pdf', buffer: pdfBuffer() }); await expect(page.getByText('사업자등록증.pdf', { exact: true })).toBeVisible(); await page.reload(); await expect(page.getByText('사업자등록증.pdf', { exact: true })).toBeVisible();
  for (const [label, value] of [['정산 계좌번호', '110123456789'], ['출고지', '서울시 성동구 성수이로 10'], ['반품 주소', '서울시 성동구 성수이로 10']]) await page.getByRole('textbox', { name: label, exact: true }).fill(value);
  await page.getByRole('button', { name: '입점 심사 요청하기' }).click(); await expect(page.getByRole('heading', { name: '입점 심사 중입니다' })).toBeVisible(); const app = (await state(page)).applications.find((a: any) => a.userId === 'buyer'); const orderCount = (await state(page)).orders.length;
  await actor(page, 'admin'); await page.goto(`/#/admin/${app.id}`); await expect(page.getByRole('button', { name: '판매자 승인', exact: true })).toBeDisabled(); await page.getByRole('button', { name: 'PDF 보기' }).click(); await expect(page.getByRole('dialog', { name: '사업자등록증 PDF' })).toBeVisible(); await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.getByRole('button', { name: '판매자 승인', exact: true }).click(); await page.getByRole('button', { name: '승인하기', exact: true }).click(); await expect(page.getByRole('heading', { name: '판매자 승인 완료' })).toBeVisible();
  await actor(page, 'buyer'); await page.goto('/#/my'); await expect(page.getByRole('button', { name: '판매자 모드로 전환' })).toBeVisible(); expect((await state(page)).orders).toHaveLength(orderCount); await page.getByRole('button', { name: '판매자 모드로 전환' }).click(); await expect(page).toHaveURL(/#\/seller$/);
});

test('비PDF 업로드·운영자 접근·승인 전 상품 등록 차단', async ({ page }) => {
  await page.goto('/#/apply'); await page.getByLabel('사업자등록증 PDF 첨부').setInputFiles({ name: '가짜.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') }); await expect(page.getByRole('alert')).toContainText('올바른 PDF'); await expect(page.getByRole('button', { name: '입점 심사 요청하기' })).toBeDisabled();
  await page.goto('/#/admin'); await expect(page.getByText('운영자만 사용할 수 있습니다.')).toBeVisible(); await page.goto('/#/seller/new'); await expect(page.getByText('승인된 판매자만 상품을 등록할 수 있습니다.')).toBeVisible();
});

test('공통 7단계 등록·AI 추천 변경 무효화·기본 옵션·게시와 판매 시작', async ({ page }) => {
  await actor(page, 'seller'); await page.goto('/#/seller/new'); await page.getByLabel('상품 이미지 업로드').setInputFiles(path.resolve('public/images/generated-5.png')); await expect(page.getByText('1 / 10장')).toBeVisible(); await page.getByLabel('상품명', { exact: true }).fill('A5 공책'); await page.getByLabel('상품 설명', { exact: true }).fill('종이로 만든 A5 공책입니다. 80페이지 구성입니다.'); await page.getByRole('button', { name: 'AI 카테고리 추천 요청' }).click(); await page.getByRole('button', { name: '이 카테고리 사용' }).click();
  await page.getByLabel('상품명', { exact: true }).fill('A5 공책 새 구성'); await expect(page.getByText('입력이 변경되어 이전 추천을 해제했어요')).toBeVisible(); await page.getByLabel('기존 판매 상품 URL', { exact: true }).fill('https://shop.example/notebook-new'); await page.getByRole('button', { name: '다음 · 상세 정보' }).click(); await expect(page.getByRole('alert')).toContainText('카테고리');
  await page.getByRole('button', { name: '직접 선택', exact: true }).click(); await page.getByRole('radio', { name: '문구 / 노트', exact: true }).check(); await page.getByRole('button', { name: '최종 카테고리 저장' }).click(); await page.getByRole('button', { name: '다음 · 상세 정보' }).click();
  await expect(page.getByText('추가 상품 정보 · 선택')).toBeVisible(); await expect(page.getByText('안감', { exact: true })).toHaveCount(0); await page.getByLabel('추가정보 1 항목명').fill('페이지 수'); await page.getByLabel('추가정보 1 내용').fill('80페이지'); await page.getByLabel('재고 처분 사유', { exact: true }).fill('과잉 발주'); await page.getByRole('button', { name: '다음 · 옵션과 재고' }).click();
  await page.getByRole('checkbox', { name: /옵션 없음/ }).check(); await page.getByLabel('기본 재고', { exact: true }).fill('10'); await page.getByRole('button', { name: '다음 · 가격과 배송' }).click(); await page.getByLabel('판매가격', { exact: true }).fill('6000'); await page.getByRole('button', { name: '다음 · 판매 시간' }).click(); await page.getByRole('button', { name: '다음 · AI 예상 질문' }).click(); await page.getByRole('button', { name: 'AI 예상 질문 생성' }).click();
  for (let i = 1; i <= 3; i++) await page.getByLabel(`예상 질문 ${i} 답변`, { exact: true }).fill(['80페이지입니다.', '2권 구성입니다.', 'A5 종이 노트입니다.'][i - 1]);
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '답변 확인 후 공개에 반영', exact: true }).first().click(); await page.getByRole('button', { name: '다음 · 미리보기' }).click(); await page.getByLabel('게시 조건 동의').check(); await page.getByRole('button', { name: '동의하고 상품 게시하기' }).click(); await expect(page.getByRole('heading', { name: '상품이 공개되었어요' })).toBeVisible();
  const p = (await state(page)).products.find((p: any) => p.name === 'A5 공책 새 구성'); expect(p.category).toBe('문구 / 노트'); expect(p.options[0].name).toBe('기본'); await page.goto(`/#/product/${p.id}`); await expect(page.getByRole('button', { name: '판매 시작 전 · 구매할 수 없어요' })).toBeDisabled();
  await tool(page, '미리보기 사용자'); await page.getByRole('button', { name: '+3시간 진행' }).filter({ visible: true }).click(); await closeTools(page); await expect(page.getByRole('button', { name: /남은 10개/ })).toBeEnabled();
});

test('상품 문의 전달·판매자 공개 답변이 FAQ와 구매자 화면에 반영', async ({ page }) => {
  await page.goto('/#/qa/ecobag'); await page.getByLabel('상품 질문').fill('손잡이가 두 개인가요?'); await page.getByRole('button', { name: '보내기', exact: true }).click(); await page.getByRole('button', { name: '판매자에게 전달', exact: true }).click(); const q = (await state(page)).inquiries.find((q: any) => q.question === '손잡이가 두 개인가요?');
  await actor(page, 'seller'); await page.goto('/#/seller/inquiries'); const form = page.locator('form').filter({ hasText: '손잡이가 두 개인가요?' }); await form.getByRole('textbox').fill('네, 손잡이는 두 개입니다.'); await form.getByRole('checkbox').check(); await form.getByRole('button', { name: '답변 저장' }).click(); expect((await state(page)).products.find((p: any) => p.id === 'ecobag').faqs.some((f: any) => f.question === q.question && f.confirmed)).toBe(true);
  await actor(page, 'buyer'); await page.goto('/#/qa/ecobag'); await expect(page.getByText('네, 손잡이는 두 개입니다.', { exact: true })).toBeVisible();
});
