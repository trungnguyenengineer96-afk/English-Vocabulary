import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openProfile } from './helpers';

async function audit(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(r.violations.map((v) => `${label}: ${v.id} — ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

test('new learner: profile → survey → adaptive placement test → result → personalised path', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('Chào mừng! Hãy tạo hồ sơ học đầu tiên.')).toBeVisible();
  await page.getByLabel('Tên của bạn').fill('Lan');
  await page.getByRole('radio', { name: 'Linh vật 🦊' }).click();
  await page.getByRole('button', { name: /Tạo hồ sơ/ }).click();

  await expect(page.getByRole('heading', { name: /Chào Lan!/ })).toBeVisible();
  await audit(page, 'placement-intro');
  await page.getByRole('button', { name: 'Bắt đầu 🚀' }).click();
  await page.getByRole('checkbox', { name: /Du lịch/ }).click();
  await audit(page, 'survey');
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.getByRole('radio', { name: /20 phút/ }).click();
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await page.getByRole('radio', { name: /Khá/ }).click();
  await page.getByRole('button', { name: /Vào bài kiểm tra/ }).click();

  let answered = 0;
  for (; answered < 25; answered++) {
    if (await page.locator('.placement-result').count()) break;
    await page.locator('.pt-question').waitFor();
    if (answered === 0) await audit(page, 'placement-question');
    const label = (await page.locator('.pt-label').textContent()) ?? '';
    // Answer the first two thirds, say "I don't know" to the rest: a realistic mixed profile.
    if (answered % 3 === 2) await page.getByRole('button', { name: /Tôi không biết/ }).click();
    else if (label.includes('Viết')) {
      await page.locator('#pt-input').fill('something');
      await page.keyboard.press('Enter');
    } else await page.locator('.pt-question .option').first().click();
    await expect(page.locator('.pt-noted.on')).toBeVisible();
    // Wait for the next question (or the result) before reading it.
    await expect(page.locator('.pt-noted.on, .placement-result').first()).toBeVisible();
    await page.waitForFunction(() => !document.querySelector('.pt-noted.on') || document.querySelector('.placement-result'));
  }
  expect(answered).toBeGreaterThanOrEqual(12);
  expect(answered).toBeLessThanOrEqual(20);
  await expect(page.getByRole('heading', { name: /Trình độ của bạn: (A1|A2|B1|B2|C1)/ })).toBeVisible();
  await expect(page.getByText(/Mỗi ngày\s+20 từ mới/)).toBeVisible();
  await expect(page.getByText(/Ưu tiên chủ đề: ✈️ Du lịch/)).toBeVisible();
  await audit(page, 'placement-result');

  await page.getByRole('button', { name: /Xem lộ trình/ }).click();
  await expect(page.getByRole('heading', { name: 'Lộ trình của Lan' })).toBeVisible();
  await expect(page.locator('.stage.current')).toHaveCount(1);
  await audit(page, 'path');

  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Nhiệm vụ hôm nay/ })).toBeVisible();
  await expect(page.getByText('Học 20 từ mới')).toBeVisible();
  await audit(page, 'home-with-quests');

  // Reopen the app: the picker appears; the placement survives.
  await page.reload();
  await expect(page.getByText('Hôm nay ai học nào?')).toBeVisible();
  await audit(page, 'picker');
  await openProfile(page, 'Lan');
  await expect(page.getByRole('button', { name: /🗺️ (A1|A2|B1|B2|C1) ·/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test('profiles keep separate progress', async ({ page }) => {
  await page.goto('/');
  // Profile A learns 7 words.
  await page.getByLabel('Tên của bạn').fill('An');
  await page.getByRole('button', { name: /Tạo hồ sơ/ }).click();
  await page.getByRole('button', { name: /Bỏ qua/ }).click();
  await page.getByRole('button', { name: /Mới bắt đầu/ }).click();
  await page.getByRole('button', { name: 'Learn', exact: true }).click();
  await page.getByRole('radio', { name: '7' }).click();
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: /Got it|Next →/ }).click();

  // Switch to a new profile B: empty library.
  await page.getByRole('button', { name: /Đổi người học/ }).click();
  await page.getByRole('button', { name: /Thêm người học/ }).click();
  await page.getByLabel('Tên của bạn').fill('Bình');
  await page.getByRole('button', { name: /Tạo hồ sơ/ }).click();
  await page.getByRole('button', { name: /Bỏ qua/ }).click();
  await page.getByRole('button', { name: /Nâng cao/ }).click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.getByText('Your library is empty.', { exact: false })).toBeVisible();

  // Back to A after a reload: still 7 words.
  await page.reload();
  await expect(page.locator('.profile-open', { hasText: 'An' })).toContainText('7 từ');
  await openProfile(page, 'An');
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.locator('.lib-row')).toHaveCount(7);
});

test('upgrading from the single-user version keeps all progress as profile 1', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    const now = Date.now();
    const item = (id: string) => ({
      vocabId: id, addedAt: now, source: 'daily', favorite: false, state: 'learning', confidence: 0.2, ease: 2.5,
      intervalDays: 1, reps: 1, lapses: 0, dueAt: now + 86400000, correctCount: 1, wrongCount: 0, unsureCount: 0,
      history: [{ at: now, mode: 'meaning-hunter', skill: 'reading', result: 'correct' }],
    });
    localStorage.setItem('vocabquest.state', JSON.stringify({
      schemaVersion: 2, settings: { dailyGoal: 7 }, library: { 'apple-n': item('apple-n'), 'river-n': item('river-n') }, xp: 123,
    }));
  });
  await page.reload();
  const card = page.locator('.profile-open', { hasText: 'Người học 1' });
  await expect(card).toContainText('2 từ');
  await expect(card).toContainText('123 XP');
  await card.click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await expect(page.locator('.lib-row')).toHaveCount(2);
  const backup = await page.evaluate(() => localStorage.getItem('vocabquest.backup.single-user'));
  expect(backup).toContain('apple-n');
});
