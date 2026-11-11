import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { actor, editState, signInDemo } from './session';
const payment = (page: Page, outcome: string) => editState(page, (s, v) => { s.paymentOutcome = v; }, outcome);
const fiveMinutesLater = (page: Page) => editState(page, s => { s.clockOffset += 300_000; });
async function reserveBag(page: Page) { await page.goto('/#/product/ecobag'); await page.getByRole('button', { name: /남은.*선착순 구매하기/ }).click(); await page.getByRole('button', { name: '내추럴 수량 추가', exact: true }).click(); await page.getByRole('button', { name: '내추럴 수량 추가', exact: true }).click(); await page.getByRole('button', { name: '구매하기', exact: true }).click(); await expect(page).toHaveURL(/checkout/); }
async function agreeAndPay(page: Page) { await page.getByRole('checkbox', { name: /주문 내용과 판매조건/ }).check(); await page.getByRole('button', { name: /안에 결제하기/ }).click(); }
async function state(page: Page) { return page.evaluate(() => JSON.parse(localStorage.getItem('stockdrop:v1')!)); }
function pdfBuffer() { return Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF'); }

test.beforeEach(async ({ page }) => { await signInDemo(page); });

test('홈 검색·카테고리 필터·외부 상품 새 탭 열기', async ({ page }) => {
  await page.getByRole('button', { name: '문구', exact: true }).click(); await expect(page.getByRole('heading', { name: 'A5 데일리 노트' })).toBeVisible(); await expect(page.getByRole('heading', { name: '모듈 수납 바구니' })).toHaveCount(0);
  await page.getByLabel('상품 검색').fill('검색되지않는상품'); await expect(page.getByText('검색 결과가 없어요')).toBeVisible(); await page.getByRole('button', { name: '필터 초기화' }).click();
  await page.goto('/#/product/ecobag'); await page.getByRole('button', { name: /기존 판매처에서 상품 보기/ }).click(); const popupPromise = page.waitForEvent('popup'); await page.getByRole('button', { name: '이동하기', exact: true }).click(); const popup = await popupPromise; await expect(popup.getByRole('heading', { name: '데일리 코튼 에코백' })).toBeVisible(); await popup.close(); await expect(page).toHaveURL(/product\/ecobag/);
  await page.goto('/#/product/notebook'); await expect(page.getByRole('button', { name: '판매 시작 전 · 구매할 수 없어요' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('재고 확보·새로고침·결제·판매자 출고·배송완료가 같은 주문으로 연결', async ({ page }) => {
  await reserveBag(page); const before = (await state(page)).holds[0].expiresAt; await page.reload(); expect((await state(page)).holds[0].expiresAt).toBe(before);
  await expect(page.getByText('41,000원', { exact: true }).first()).toBeVisible(); await agreeAndPay(page); await expect(page.getByRole('heading', { name: '축하해요!' })).toBeVisible();
  const order = (await state(page)).orders.find((o: any) => o.productId === 'ecobag' && o.userId === 'buyer' && o.status === 'paid'); expect(order.lines.map((l: any) => [l.name, l.quantity])).toEqual([['내추럴', 2]]);
  await actor(page, 'seller'); await page.goto(`/#/seller/orders/${order.id}`); await page.getByRole('button', { name: '송장 등록', exact: true }).click(); await page.getByLabel('운송장 번호', { exact: true }).fill('789456123000'); await page.getByRole('button', { name: '등록하기', exact: true }).click();
  await page.getByRole('button', { name: '배송완료 확인', exact: true }).click(); await page.getByRole('button', { name: '배송완료 처리', exact: true }).click(); await expect(page.getByRole('heading', { name: '배송이 완료됐어요' })).toBeVisible();
  await actor(page, 'buyer'); await page.goto(`/#/orders/${order.id}`); await page.reload(); expect((await state(page)).orders.find((o: any) => o.id === order.id).status).toBe('delivered');
});

test('결제 결과 확인 중에는 5분이 지나도 재고가 반환되지 않고 승인 후 한 번만 확정', async ({ page }) => {
  await payment(page, 'pending'); await reserveBag(page); await agreeAndPay(page); await expect(page.getByRole('button', { name: '결제 결과 다시 확인' })).toBeVisible();
  await fiveMinutesLater(page); await page.waitForTimeout(1200); expect((await state(page)).holds[0].status).toBe('pending');
  await payment(page, 'success'); await page.getByRole('button', { name: '결제 결과 다시 확인' }).click(); await expect(page.getByRole('heading', { name: '축하해요!' })).toBeVisible(); expect((await state(page)).orders.filter((o: any) => o.productId === 'ecobag' && o.userId === 'buyer' && o.status === 'paid')).toHaveLength(1);
});

test('5분 만료와 새로고침 시 재고 확보 시간 연장 방지', async ({ page }) => {
  await reserveBag(page); await fiveMinutesLater(page); await expect(page.getByText(/만료되어 확보한 재고가 해제됐어요/)).toBeVisible(); await page.reload(); await expect(page.getByText('주문이 취소됐어요')).toBeVisible(); await expect(page.getByRole('button', { name: /안에 결제하기/ })).toHaveCount(0);
});

test('사업자 PDF 신청 후 운영자 승인 시 기존 구매 권한과 주문이 유지', async ({ page }) => {
  // 출고지·반품 주소는 주소 검색으로만 채워지므로 신청서 임시저장에 미리 넣어 둔다
  await page.evaluate(() => localStorage.setItem('application-draft:buyer', JSON.stringify({ displayName: '나의 상점', name: '김서윤', email: 'buyer@example.com', phone: '01012345678', bank: '신한은행', account: '', shippingPostal: '04782', shippingAddress: '서울시 성동구 성수이로 10', returnPostal: '04782', returnAddress: '서울시 성동구 성수이로 10' })));
  await page.goto('/#/apply'); await expect(page.getByLabel('쇼핑몰 URL')).toHaveCount(0); await expect(page.getByRole('button', { name: '입점 심사 요청하기' })).toBeDisabled();
  await page.getByLabel('사업자등록증 PDF 첨부').setInputFiles({ name: '사업자등록증.pdf', mimeType: 'application/pdf', buffer: pdfBuffer() }); await expect(page.getByText('사업자등록증.pdf', { exact: true })).toBeVisible(); await page.reload(); await expect(page.getByText('사업자등록증.pdf', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '정산 계좌번호', exact: true }).fill('110123456789'); await expect(page.getByRole('button', { name: '입점 심사 요청하기' })).toBeEnabled();
  // 신청 전송은 백엔드 API 연결 후 검증 — 지금은 접수된 신청을 상태에 넣고 운영자 승인부터 확인
  const orderCount = (await state(page)).orders.length;
  await editState(page, s => { s.applications.push({ id: 'SP-E2E-1', userId: 'buyer', displayName: '나의 상점', name: '김서윤', email: 'buyer@example.com', phone: '01012345678', document: { id: 'doc-e2e', name: '사업자등록증.pdf', size: 1, uploadedAt: Date.now() }, bank: '신한은행', account: '110123456789', shippingAddress: '서울시 성동구 성수이로 10', returnAddress: '서울시 성동구 성수이로 10', status: 'pending', submittedAt: Date.now() }); });
  const app = { id: 'SP-E2E-1', displayName: '나의 상점' };
  await actor(page, 'admin'); await page.goto('/#/admin'); await page.getByRole('link', { name: new RegExp(app.displayName) }).click(); await expect(page).toHaveURL(new RegExp(`#/admin/${app.id}$`));
  await expect(page.getByRole('button', { name: '승인하기', exact: true })).toBeDisabled(); await page.getByRole('button', { name: '열람하기' }).click();
  await page.getByRole('button', { name: '승인하기', exact: true }).click(); await page.getByRole('button', { name: '승인하기', exact: true }).last().click(); await expect(page).toHaveURL(/#\/admin$/); expect((await state(page)).applications.find((a: any) => a.id === app.id).status).toBe('approved');
  await actor(page, 'buyer'); await page.goto('/#/my'); await expect(page.getByRole('button', { name: '판매자 모드로 전환' })).toBeVisible(); expect((await state(page)).orders).toHaveLength(orderCount); await page.getByRole('button', { name: '판매자 모드로 전환' }).click(); await expect(page).toHaveURL(/#\/seller$/);
  await page.goto('/#/seller/my'); await page.getByRole('button', { name: '구매자 모드로 전환' }).click(); await expect(page).toHaveURL(/#\/$/); await expect(page.getByRole('navigation', { name: '구매자 하단 메뉴' })).toBeVisible();
});

test('운영자 입점 반려는 확인창을 거쳐 목록으로 돌아간다', async ({ page }) => {
  await editState(page, s => { s.applications.push({ id: 'SP-TEST-1', userId: 'buyer', displayName: '반려 테스트 상점', name: '김서윤', email: 'buyer@example.com', phone: '01012345678', document: { id: 'doc-x', name: '사업자등록증.pdf', size: 1, uploadedAt: Date.now() }, bank: '신한은행', account: '110123456789', shippingAddress: '서울', returnAddress: '서울', salesUrl: 'https://coupang.com/vp/products/7348215906', status: 'pending', submittedAt: Date.now() }); });
  await actor(page, 'admin'); await page.goto('/#/admin/SP-TEST-1'); await page.getByRole('button', { name: '열람하기' }).click(); await expect(page.getByRole('button', { name: '반려', exact: true })).toBeDisabled(); const popup = page.waitForEvent('popup'); await page.getByRole('link', { name: '열기', exact: true }).click(); await (await popup).close();
  await page.getByRole('button', { name: '반려', exact: true }).click(); await expect(page.getByRole('button', { name: '반려하기' })).toBeDisabled(); await page.getByLabel('입점 반려 사유').fill('사업자등록증 상호와 표시 이름이 달라요.'); await page.getByRole('button', { name: '반려하기' }).click();
  await expect(page).toHaveURL(/#\/admin$/); expect((await state(page)).applications.find((a: any) => a.id === 'SP-TEST-1').status).toBe('rejected');
});

test('비PDF 업로드·운영자 접근·승인 전 상품 등록 차단', async ({ page }) => {
  await page.goto('/#/apply'); await page.getByLabel('사업자등록증 PDF 첨부').setInputFiles({ name: '가짜.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') }); await expect(page.getByRole('alert')).toContainText('올바른 PDF'); await expect(page.getByRole('button', { name: '입점 심사 요청하기' })).toBeDisabled();
  await page.goto('/#/admin'); await expect(page.getByText('운영자만 사용할 수 있습니다.')).toBeVisible(); await page.goto('/#/seller/new'); await expect(page.getByText('승인된 판매자만 상품을 등록할 수 있습니다.')).toBeVisible();
});
