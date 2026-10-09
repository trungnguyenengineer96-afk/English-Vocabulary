import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const summary = r.violations.map((v) => `${label}: ${v.id} (${v.impact}) ×${v.nodes.length} — ${v.nodes[0]?.target.join(' ')}`);
  expect(summary).toEqual([]);
}

test('main screens and a session have no WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  await audit(page, 'home-empty');
  await page.getByRole('button', { name: 'Start learning' }).click();
  await audit(page, 'learn');
  for (let i = 0; i < 10; i++) await page.getByRole('button', { name: /Got it|Next →/ }).click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await audit(page, 'library');
  await page.locator('.lib-main').first().click();
  await audit(page, 'word-detail');
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await audit(page, 'play');
  await page.getByRole('button', { name: 'Progress', exact: true }).click();
  await audit(page, 'progress');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await audit(page, 'settings');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await audit(page, 'home');
  await page.getByRole('button', { name: /Mixed Challenge/ }).click();
  await audit(page, 'session-question');
  await page.getByRole('button', { name: /I don't know/ }).click();
  await audit(page, 'session-feedback');
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });
  test('home and play have sufficient contrast in dark mode', async ({ page }) => {
    await page.goto('/#/learn');
    for (let i = 0; i < 10; i++) await page.getByRole('button', { name: /Got it|Next →/ }).click();
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await audit(page, 'home-dark');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await audit(page, 'play-dark');
  });
});
