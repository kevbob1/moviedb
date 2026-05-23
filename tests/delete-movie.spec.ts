import { test, expect } from '@playwright/test';

test('delete a movie from the detail page', async ({ page }) => {
  // Start at movie listing — seeded movie should be visible
  await page.goto('/movies');
  await expect(page.getByText('The Matrix')).toBeVisible();

  // Click through to the movie detail page
  await page.getByText('The Matrix').click();
  await page.waitForURL(/\/movies\/\d+/);
  await expect(page.getByRole('heading', { name: 'The Matrix' })).toBeVisible();

  // Click delete and accept the confirmation dialog
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Movie' }).click();

  // After deletion, should redirect back to /movies
  await page.waitForURL('**/movies');
  await expect(page.getByText('Fight Club')).not.toBeVisible();
});

test('cancel delete does not remove the movie', async ({ page }) => {
  await page.goto('/movies');
  await page.getByText('The Matrix').click();
  await page.waitForURL(/\/movies\/\d+/);

  // Dismiss the confirmation dialog
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Movie' }).click();

  // Should still be on the detail page — movie not deleted
  await expect(page.getByRole('heading', { name: 'The Matrix' })).toBeVisible();
});
