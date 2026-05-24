import { test, expect } from '@playwright/test';

test('search page renders correctly', async ({ page }) => {
  // Navigate to the search page
  await page.goto('/search');

  // Verify heading is visible
  await expect(page.getByRole('heading', { name: 'Request a Movie' })).toBeVisible();

  // Verify search form is present
  await expect(page.getByPlaceholder('Search for a movie...')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Search' })).toBeVisible();

  // Check that the main content container exists
  await expect(page.getByText('Request a Movie').locator('xpath=..')).toBeVisible();
});

test('search page allows text input', async ({ page }) => {
  await page.goto('/search');

  // Verify input field exists and accepts text
  const searchInput = page.getByPlaceholder('Search for a movie...');
  await expect(searchInput).toBeEditable();

  // Type some text
  await searchInput.fill('Test');

  // Verify the text is in the input
  await expect(searchInput).toHaveValue('Test');
});

test('search form has submit button', async ({ page }) => {
  await page.goto('/search');

  // Find the search button - it should exist even if not functional without backend
  const searchButton = page.getByRole('button', { name: /^Search$/ } );

  // Verify button is present
  await expect(searchButton).toBeVisible();

  // Verify button is enabled
  await expect(searchButton).toBeEnabled();
});

test('search page has movie grid structure', async ({ page }) => {
  await page.goto('/search');

  // Verify the grid structure exists for movie results container
  // The grid should be present in the DOM even if empty
  // (it may be hidden initially since no results exist)
  await expect(page.locator('div.grid')).toHaveCount(1);
});