import { test, expect } from '@playwright/test';

test('Dominoes game starts without console error', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', error => errors.push(error));
  page.on('console', msg => {
    if (msg.type() === 'error') {
       console.log('Browser Error:', msg.text());
    }
  });

  await page.goto('http://localhost:8080');

  // Create dominoes game
  await page.click('text=Games');
  await page.click('text=Dominoes');

  // Wait for lobby
  await page.waitForURL(/\/lobby\//);
  const lobbyCode = page.url().split('/').pop();

  // Click Start Playing
  // Host is automatically ready
  await page.click('text=Start Game');

  // Wait for game view
  await page.waitForURL(/\/game\/dominoes\//);

  expect(errors).toHaveLength(0);
});
