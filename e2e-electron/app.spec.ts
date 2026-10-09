import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Launches the desktop shell (electron/main.cjs) against the built dist/ and
// checks that progress survives closing and reopening the app.
test('desktop app loads, learns words and keeps progress after restart', async () => {
  const userData = mkdtempSync(path.join(tmpdir(), 'vq-user-'));
  const launch = () =>
    electron.launch({ args: ['.', `--user-data-dir=${userData}`, '--no-sandbox'], cwd: path.resolve(import.meta.dirname, '..') });

  let app = await launch();
  let win = await app.firstWindow();
  await expect(win).toHaveTitle('Vocab Quest');
  await win.getByRole('button', { name: 'Start learning' }).click();
  await win.getByRole('radio', { name: '7' }).click();
  for (let i = 0; i < 7; i++) await win.getByRole('button', { name: /Got it|Next →/ }).click();
  await expect(win.getByText('Daily goal complete!')).toBeVisible();
  await app.close();

  app = await launch();
  win = await app.firstWindow();
  await win.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(win.getByLabel('7 of 7 new words learned today')).toBeVisible();
  await win.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(win.locator('.lib-row')).toHaveCount(7);
  await app.close();
});
