import { test, expect } from '@playwright/test';

/**
 * Tasks 2 (TODO00000143): the search bar finds tasks and records in one
 * search, in groups, and each result opens its address. The backend applies
 * the caller's security; the specs act as the synthetic admin.
 */

test.describe('Tasks 2: search over tasks and records', () => {
  test('a task is found by its name and opens its page', async ({ page }) => {
    await page.goto('/data/workers');
    await page.getByPlaceholder('Search tasks and records...').fill('incid');

    const tasks = page.getByTestId('search-group-task');
    await expect(tasks.getByText('Tasks', { exact: true })).toBeVisible();
    // Two tasks are called Incidents; the area beside the name tells them apart.
    await expect(tasks.getByRole('button', { name: 'Incidents Ops Team', exact: true })).toBeVisible();
    await tasks.getByRole('button', { name: 'Incidents Data', exact: true }).click();

    await expect(page).toHaveURL(/\/data\/incidents$/);
    await expect(page.getByTestId('search-results')).toHaveCount(0);
  });

  test('a record is found in its group and opens its detail page', async ({ page }) => {
    await page.goto('/data/workers');
    await page.getByPlaceholder('Search tasks and records...').fill('Gate Org');

    const organizations = page.getByTestId('search-group-organization');
    await expect(organizations.getByText('Organizations', { exact: true })).toBeVisible();
    await organizations.getByRole('button', { name: 'Gate Org A', exact: true }).click();

    await expect(page).toHaveURL(/\/data\/organizations\/[\w-]{22}$/);
  });

  test('a kind the bar could not reach before is found: incidents', async ({ page }) => {
    await page.goto('/data/workers');
    await page.getByPlaceholder('Search tasks and records...').fill('synthetic incident');
    const incidents = page.getByTestId('search-group-incident');
    await expect(incidents.getByText('Incidents', { exact: true })).toBeVisible();
    await expect(incidents.getByRole('button').first()).toContainText('synthetic incident');
  });
});
