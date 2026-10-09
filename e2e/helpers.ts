import type { Page } from '@playwright/test';

/** First run: create a profile and skip the placement test (choose a level). */
export async function enterApp(page: Page, name = 'Tester', level: RegExp = /Trung cấp/) {
  await page.goto('/');
  await page.getByLabel('Tên của bạn').fill(name);
  await page.getByRole('button', { name: /Tạo hồ sơ/ }).click();
  await page.getByRole('button', { name: /Bỏ qua, tôi tự chọn trình độ/ }).click();
  await page.getByRole('button', { name: level }).click();
}

/** After a reload the picker appears: open an existing profile. */
export async function openProfile(page: Page, name = 'Tester') {
  await page.locator('.profile-open', { hasText: name }).click();
}
