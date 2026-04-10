import { expect, test } from '@playwright/test';

test('@live SPA live relay: connect, receive content, no blank screen/errors', async ({ page }) => {
  const pageErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/');

  await expect(page.locator('.p-index-wrap')).toBeVisible();

  // Relay status should eventually show at least one connected relay.
  await expect(page.locator('.p-index-relay-status-label', { hasText: 'ON AIR' }).first()).toBeVisible({
    timeout: 30_000,
  });

  // Live relay should deliver at least one feed item.
  await expect.poll(async () => page.locator('.c-feed-item').count(), {
    timeout: 30_000,
    message: 'Expected at least one feed item from live relay',
  }).toBeGreaterThan(0);

  const bodyTextLength = await page.evaluate(() => document.body.innerText.trim().length);
  expect(bodyTextLength).toBeGreaterThan(0);

  expect(pageErrors).toEqual([]);
});
