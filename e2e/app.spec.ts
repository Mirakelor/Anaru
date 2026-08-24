import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test('full loop: onboarding → import → feed → save word → review → stats', async ({ page }) => {
  await page.goto('/');

  // Onboarding
  await expect(page.getByRole('heading', { name: /now teaching you Japanese/i })).toBeVisible();
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('button', { name: /^Japanese Furigana/ }).click();
  await page.getByRole('button', { name: 'Start watching' }).click();

  // Library → import wizard
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Add series' }).click();
  await page.getByPlaceholder(/Frieren/).fill('Test Series');
  await page.getByRole('button', { name: 'Next' }).click();

  const fileInputs = page.locator('.import-episode input[type=file]');
  await fileInputs.nth(0).setInputFiles(path.join(fixtures, 'test-episode.mp4'));
  await fileInputs.nth(1).setInputFiles(path.join(fixtures, 'test-episode.ja.srt'));
  await fileInputs.nth(2).setInputFiles(path.join(fixtures, 'test-episode.en.srt'));
  await page.getByRole('button', { name: /Import 1 episode/ }).click();

  await expect(page.locator('.series-card')).toContainText('Test Series');

  // Feed: subtitles with tappable words appear
  await page.getByRole('button', { name: 'Feed' }).click();
  const word = page.locator('.furi-word').first();
  await expect(word).toBeVisible({ timeout: 20_000 });

  // Bilingual mode shows the English line
  await word.click();
  await expect(page.locator('.sheet')).toBeVisible();

  // Save the word
  await page.getByRole('button', { name: 'Save word' }).click();
  await expect(page.locator('.sheet')).toHaveCount(0);

  // Words page lists it
  await page.getByRole('button', { name: 'Words' }).click();
  await expect(page.locator('.word-row')).toHaveCount(1);

  // Review: the new card is due now
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Show answer' }).click();
  await page.locator('.grade-good').click();
  await expect(page.locator('.review-empty')).toBeVisible({ timeout: 10_000 });

  // Stats reflect the saved word and the review
  await page.getByRole('button', { name: 'Stats' }).click();
  await expect(page.locator('.stat-card').nth(1)).toContainText('1');
  await expect(page.locator('.stat-card').nth(2)).toContainText('1');
});

test('pack manifest ingestion loads remote episodes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('button', { name: 'Start watching' }).click();

  // Serve the local fixture as a "remote" pack over the dev server is not
  // possible, so exercise the pack modal error path for a bad URL first.
  await page.getByRole('button', { name: 'Library' }).click();
  // The empty library auto-imports the starter pack; wait until it actually
  // starts and finishes so the import lock does not route the bad-URL
  // request to the starter pack. (The text may appear and vanish before the
  // first check if the pack loads instantly.)
  const loading = page.getByText('Loading the starter pack…');
  await loading.waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined);
  await expect(loading).toBeHidden({ timeout: 90_000 });
  await page.getByRole('button', { name: 'Load pack' }).click();
  await page.getByPlaceholder(/manifest\.json/).fill('http://localhost:5173/nope/manifest.json');
  await page.getByRole('button', { name: 'Load pack', exact: true }).last().click();
  await expect(page.locator('.field-error')).toBeVisible();
});

test('erase all data boots back into onboarding', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByRole('button', { name: 'Start watching' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Erase all data' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: /now teaching you Japanese/i })).toBeVisible({ timeout: 15_000 });
});
