import { test, expect } from '@playwright/test';

test('Verify Leave button in Lobby', async ({ page }) => {
  await page.goto('http://localhost:8080/');
  console.log('Navigated to home page');

  // Wait for the page to load
  await page.waitForSelector('text=Choose Your Game', { timeout: 10000 });
  console.log('Home page loaded');

  // Click on Uno to create a lobby
  // The GameCard has onClick on its main container.
  // Selecting by text 'Uno' inside it should work.
  await page.click('text=Uno');
  console.log('Clicked Uno');

  // Wait for the lobby to load
  await page.waitForURL(/\/lobby\//, { timeout: 15000 });
  console.log('URL is now /lobby/');

  // Wait for loading state to finish (1.5s in code)
  await page.waitForTimeout(2000);

  // Check for the Leave button
  // We use a more specific locator if possible.
  const leaveButton = page.getByRole('button', { name: 'Leave' });

  try {
    await expect(leaveButton).toBeVisible({ timeout: 10000 });
    console.log('Leave button IS visible in lobby');

    await leaveButton.click();
    console.log('Clicked Leave button');

    await expect(page).toHaveURL('http://localhost:8080/', { timeout: 5000 });
    console.log('Successfully returned to home page');
  } catch (error) {
    console.log('Failed to find or click Leave button');
    await page.screenshot({ path: '/home/jules/verification/lobby_leave_debug.png' });
    throw error;
  }
});
