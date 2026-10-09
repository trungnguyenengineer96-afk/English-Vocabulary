import { expect, test, type Page } from '@playwright/test';

async function answerCurrent(page: Page) {
  if (await page.locator('.option').count()) {
    await page.locator('.option').first().click();
  } else if (await page.getByRole('button', { name: /Flip card/ }).count()) {
    await page.getByRole('button', { name: /Flip card/ }).click();
    await page.getByRole('button', { name: /I knew it/ }).click();
  } else if (await page.locator('#answer-input').count()) {
    await page.locator('#answer-input').fill('something');
    await page.keyboard.press('Enter');
  } else {
    await page.getByRole('button', { name: /I don't know/ }).click();
  }
}

test('daily words → library persists on reload → adaptive review → results → dashboard', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await page.getByRole('button', { name: 'Start learning' }).click();
  await page.getByRole('radio', { name: '7' }).click();
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: /Got it|Next →/ }).click();
  await expect(page.getByText('Daily goal complete!')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /Library/ }).click();
  await expect(page.locator('.lib-row')).toHaveCount(7);

  await page.getByRole('button', { name: /Home/ }).click();
  await expect(page.getByLabel('7 of 7 new words learned today')).toBeVisible();
  await page.getByRole('button', { name: 'Start adaptive review' }).click();

  for (let step = 0; step < 7; step++) {
    await answerCurrent(page);
    await page.getByRole('button', { name: /^(Next|See results)/ }).click();
  }
  await expect(page.getByText('7/7 answered')).toBeVisible();
  await page.getByRole('button', { name: /Back to dashboard/ }).click();
  await expect(page.getByText(/answered \(last session\)/)).toBeVisible();
  await expect(page.getByText('0/7 saved words mastered')).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: /Progress/ }).click();
  await expect(page.locator('table.sessions tbody tr')).toHaveCount(1);
  expect(errors).toEqual([]);
});
