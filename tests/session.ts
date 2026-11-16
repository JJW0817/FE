import type { Page } from '@playwright/test';
/** 저장된 목업 상태를 고친 뒤 새로고침해서 앱이 다시 읽게 한다 (예전 '로컬 미리보기' 패널 대신) */
export async function editState(page: Page, fn: (s: any, arg: any) => void, arg?: unknown) {
  await page.evaluate(([src, a]) => { const s = JSON.parse(localStorage.getItem('stockdrop:v1')!); new Function('s', 'arg', `(${src})(s, arg)`)(s, a); localStorage.setItem('stockdrop:v1', JSON.stringify(s)); }, [fn.toString(), arg] as const);
  await page.reload();
}
/** 목업 계정으로 전환 (buyer · seller · admin) */
export async function actor(page: Page, id: string) { await editState(page, (s, id) => { s.auth.userId = id; s.auth.onboarded = true; s.activeUserId = id; s.mode = id === 'admin' ? 'admin' : 'buyer'; }, id); }
export async function signInDemo(page: Page) { await page.goto('/#/'); await page.waitForFunction(() => !!localStorage.getItem('stockdrop:v1')); await actor(page, 'buyer'); await page.goto('/#/'); }
