import AxeBuilder from '@axe-core/playwright';
import { enterApp } from './helpers';
import { expect, test } from '@playwright/test';

test('every available mode launches, is accessible, and can be abandoned', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enterApp(page);
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: /Browse word bank/ }).click();
  for (let i = 0; i < 40; i++) await page.locator('.bank-list .btn').nth(i % 4).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const count = await page.locator('.mode-tile').count();
  expect(count).toBe(30);
  const played: string[] = [];
  for (let i = 0; i < count; i++) {
    await page.evaluate(() => (window.location.hash = '/play'));
    const tile = page.locator('.mode-tile').nth(i);
    const name = (await tile.locator('.tile-name').textContent())!.trim();
    await tile.click();
    await expect(page.locator('#mode-title')).toContainText(name);
    const r = await new AxeBuilder({ page }).include('.mode-card').withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(r.violations.map((v) => `${name}: ${v.id} — ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    await page.getByRole('button', { name: /I don't know/ }).click();
    await expect(page.getByRole('button', { name: /^(Next|See results)/ })).toBeFocused();
    played.push(name);
  }
  // Bundled pronunciation clips make every mode available, including the 7 listening modes.
  expect(played.length).toBe(30);
  expect(errors).toEqual([]);
});
