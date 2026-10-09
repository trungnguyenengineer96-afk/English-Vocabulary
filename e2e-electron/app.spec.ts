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
  // First launch: create a profile, skip the placement test.
  await win.getByLabel('Tên của bạn').fill('Desk');
  await win.getByRole('button', { name: /Tạo hồ sơ/ }).click();
  await win.getByRole('button', { name: /Bỏ qua, tôi tự chọn trình độ/ }).click();
  await win.getByRole('button', { name: /Trung cấp/ }).click();
  await win.getByRole('button', { name: 'Start learning' }).click();
  await win.getByRole('radio', { name: '7' }).click();
  for (let i = 0; i < 7; i++) await win.getByRole('button', { name: /Got it|Next →/ }).click();
  await expect(win.getByText('Daily goal complete!')).toBeVisible();

  // Sound: clicking a speaker button plays a bundled MP3 to the end (no system voice needed).
  await win.evaluate(() => {
    const w = window as unknown as { __played: { src: string; ended: boolean; error: boolean }[] };
    w.__played = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      const rec = { src: this.currentSrc || this.src, ended: false, error: false };
      w.__played.push(rec);
      this.addEventListener('ended', () => (rec.ended = true));
      this.addEventListener('error', () => (rec.error = true));
      return orig.call(this);
    };
  });
  await win.getByRole('button', { name: /^Pronounce / }).first().click();
  await expect
    .poll(() => win.evaluate(() => (window as unknown as { __played: { ended: boolean }[] }).__played.some((p) => p.ended)), { timeout: 10_000 })
    .toBe(true);
  const played = await win.evaluate(() => (window as unknown as { __played: { src: string; error: boolean }[] }).__played);
  expect(played[0].src).toMatch(/^file:.*\/audio\/[0-9a-f]{12}\.mp3$/);
  expect(played.every((p) => !p.error)).toBe(true);
  await app.close();

  app = await launch();
  win = await app.firstWindow();
  // Every launch starts at the profile picker.
  await expect(win.getByText('Hôm nay ai học nào?')).toBeVisible();
  await win.locator('.profile-open', { hasText: 'Desk' }).click();
  await win.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(win.getByLabel('7 of 7 new words learned today')).toBeVisible();
  await win.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(win.locator('.lib-row')).toHaveCount(7);
  await app.close();
});
