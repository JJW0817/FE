import type { Page } from '@playwright/test';
export async function signInDemo(page: Page) { await page.goto('/#/login'); await page.getByText('로컬 미리보기 · 실제 결제 없음').click(); await page.locator('[aria-label="미리보기 사용자"]:visible').selectOption('buyer'); await page.getByText('로컬 미리보기 · 실제 결제 없음').click(); }
