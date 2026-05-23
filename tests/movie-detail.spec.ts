import { test, expect } from '@playwright/test';

test('movie detail page renders correctly for seeded movie', async ({ page }) => {
  // Navigate to movies listing and click the seeded movie
  await page.goto('/movies');
  await page.getByText('Fight Club').click();
  await page.waitForURL(/\/movies\/\d+/);

  // Title
  await expect(page.getByRole('heading', { name: 'Fight Club' })).toBeVisible();

  // Description
  await expect(page.getByText('A ticking-Loss, bomb-insane insurance clerk...')).toBeVisible();

  // Year
  await expect(page.getByText('1999')).toBeVisible();

  // Rating
  await expect(page.getByText('★ 8.4')).toBeVisible();

  // Genre badges
  await expect(page.getByText('Drama')).toBeVisible();
  await expect(page.getByText('Thriller')).toBeVisible();

  // Delete button
  await expect(page.getByRole('button', { name: 'Delete Movie' })).toBeVisible();

  // Back link
  await expect(page.getByRole('link', { name: '← Back to movies' })).toBeVisible();
});