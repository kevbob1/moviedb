import { test, expect } from '@playwright/test';

test.describe('Request FSM and Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/movies');
  });

  test('request lifecycle: pending -> downloading -> fulfilled', async ({ page }) => {
    await expect(page.getByText('Pending')).toBeVisible();

    await page.getByText('Start Download').first().click();
    await expect(page.getByText('Downloading')).toBeVisible();

    await page.getByText('Mark Fulfilled').first().click();
    await expect(page.getByText('Fulfilled')).toBeVisible();
  });

  test('request lifecycle: pending -> fulfilled', async ({ page }) => {
    await expect(page.getByText('Pending')).toBeVisible();

    await page.getByText('Mark Fulfilled').first().click();
    await expect(page.getByText('Fulfilled')).toBeVisible();
  });

  test('request lifecycle: pending -> canceled', async ({ page }) => {
    await expect(page.getByText('Pending')).toBeVisible();

    await page.getByText('Cancel').first().click();
    await expect(page.getByText('Canceled')).toBeVisible();
  });

  test('fulfilled filter checkbox hides fulfilled requests by default', async ({ page }) => {
    await page.goto('/movies?showFulfilled=false');
    await expect(page.getByText('Fulfilled')).not.toBeVisible();

    await page.getByLabel('Show fulfilled').check();
    await expect(page.getByText('Fulfilled')).toBeVisible();
  });
});