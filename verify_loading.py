import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("http://localhost:8081")
        # Wait for the loader to appear (it should be immediate)
        await page.wait_for_selector("text=LOADING")
        await page.screenshot(path="loading_verification.png")
        print("Captured loading_verification.png")
        await browser.close()

asyncio.run(run())
