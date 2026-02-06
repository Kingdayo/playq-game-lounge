const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set a large viewport
  await page.setViewportSize({ width: 1280, height: 720 });

  // Go to the page
  console.log('Navigating to Pictionary game...');
  await page.goto('http://localhost:8080/game/pictionary/TEST123');

  // Wait for the loading to finish (the MaterialLoading duration is 6s for first load)
  console.log('Waiting for loading to finish...');
  await page.waitForTimeout(10000);

  // Check if "Lobby not found" is present
  const lobbyNotFound = await page.isVisible('text=Lobby not found');
  if (lobbyNotFound) {
    console.log('Lobby not found detected.');
  }

  // Take a screenshot
  await page.screenshot({ path: '/home/jules/verification/pictionary_game_v2.png' });
  console.log('Screenshot saved to /home/jules/verification/pictionary_game_v2.png');

  await browser.close();
})();
