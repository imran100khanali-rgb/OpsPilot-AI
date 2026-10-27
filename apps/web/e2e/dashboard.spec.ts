import { test, expect } from '@playwright/test';

test.describe('OpsPilot AI Command Center E2E', () => {
  test('displays platform title and infrastructure diagnostics', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/OpsPilot AI/i);

    // Check header branding
    await expect(page.locator('.logo-text')).toHaveText('OpsPilot AI');

    // Check core sections
    await expect(page.locator('h1')).toContainText('Enterprise Operations Command Center');
    await expect(page.locator('text=Infrastructure Health & Diagnostics')).toBeVisible();
    await expect(page.locator('text=Monitored Enterprise Systems')).toBeVisible();
    await expect(page.locator('text=AI Operations Incident Diagnostics')).toBeVisible();
  });
});
