import { test, expect } from '@playwright/test';

test.describe('Loading Animation Timing', () => {
  test('initial load lasts for 6 seconds', async ({ page }) => {
    await page.goto('/');

    // At 2 seconds, it should still be there
    await page.waitForTimeout(2000);
    await expect(page.get_by_text('LOADING', { exact: false })).toBeVisible();

    // At 5 seconds, it should still be there
    await page.waitForTimeout(3000);
    await expect(page.get_by_text('LOADING', { exact: false })).toBeVisible();

    // At 7 seconds, it should be gone
    await page.waitForTimeout(2000);
    await expect(page.get_by_text('LOADING', { exact: false })).not.toBeVisible();
  });

  test('navigation load lasts for 2 seconds', async ({ page }) => {
    await page.goto('/');

    // Wait for initial loader to clear (6s + buffer)
    await page.waitForTimeout(7500);
    await expect(page.get_by_text('LOADING', { exact: false })).not.toBeVisible();

    // Navigate to Games tab
    await page.get_by_role('link', { name: 'Games' }).first().click();

    // At 1 second, it should be there
    await page.waitForTimeout(1000);
    await expect(page.get_by_text('LOADING', { exact: false })).toBeVisible();

    // At 4 seconds, it should be gone
    await page.waitForTimeout(3000);
    await expect(page.get_by_text('LOADING', { exact: false })).not.toBeVisible();
  });
});
