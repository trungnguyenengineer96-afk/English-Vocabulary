import { expect, test } from '@playwright/test';
import { enterApp } from './helpers';

test('Mixed Challenge: 20 distinct words over 4 rounds, results with skill breakdown and review queue', async ({ page }) => {
  await enterApp(page);
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: /Browse word bank/ }).click();
  for (let i = 0; i < 25; i++) await page.locator('.bank-list .btn').nth(i % 5).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: /Start challenge/ }).click();
  const rounds = new Set<string>();
  const modes = new Set<string>();
  for (let step = 0; step < 40; step++) {
    if (await page.getByRole('button', { name: /Back to dashboard/ }).count()) break;
    rounds.add((await page.locator('.round-banner').textContent()) ?? '');
    modes.add((await page.locator('#mode-title').textContent()) ?? '');
    await page.getByRole('button', { name: /I don't know/ }).click();
    await page.getByRole('button', { name: /^(Next|See results)/ }).click();
  }
  expect([...rounds].map((r) => r.slice(0, 9))).toEqual(['Round 1/4', 'Round 2/4', 'Round 3/4', 'Round 4/4']);
  expect(modes.size).toBeGreaterThanOrEqual(6);
  await expect(page.getByText('20/20 answered')).toBeVisible();
  await expect(page.getByLabel('Accuracy by skill')).toBeVisible();
  await expect(page.locator('.queue li')).toHaveCount(20);
  await page.getByRole('button', { name: /Review missed words now \(20\)/ }).click();
  await expect(page.locator('#mode-title')).toBeVisible();
});
