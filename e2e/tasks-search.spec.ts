import { test, expect } from '@playwright/test';

/**
 * Tasks 2 (TODO00000143): the search bar finds tasks and records in one
 * search, in groups, and each result opens its address. The backend applies
 * the caller's security; the specs act as the synthetic admin.
 */

test.describe('Tasks 2: search over tasks and records', () => {
  test('a task is found by a name and opens its page', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    await page.getByPlaceholder('Search tasks and records...').fill('incid');

    const tasks = page.getByTestId('search-group-task');
    await expect(tasks.getByText('Tasks', { exact: true })).toBeVisible();
    // Since the catalog v3 (TODO00000140 A14, lane F1) a task shows its grouping
    // beside it; one found through a view names the view.
    await expect(tasks.getByRole('button', { name: 'Monitor IT Tickets Incidents Operations', exact: true })).toBeVisible();
    // View IT Incidents is found best through its one view, Incidents.
    await tasks.getByRole('button', { name: 'View IT Incidents Incidents Data', exact: true }).click();

    await expect(page).toHaveURL(/\/tasks\/it-incidents$/);
    await expect(page.getByTestId('search-results')).toHaveCount(0);
  });

  test('a task found by its own name opens where it opens for the person', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    await page.getByPlaceholder('Search tasks and records...').fill('maintain access');
    await page.getByTestId('search-group-task')
      .getByRole('button', { name: 'Maintain Access Administration', exact: true }).click();

    await expect(page).toHaveURL(/\/tasks\/access\/accounts$/);
  });

  test("a task found through one of its views opens that view", async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    await page.getByPlaceholder('Search tasks and records...').fill('incid');
    await page.getByTestId('search-group-task')
      .getByRole('button', { name: 'Monitor IT Tickets Incidents Operations', exact: true }).click();

    await expect(page).toHaveURL(/\/tasks\/it-tickets\/incidents$/);
    await expect(page.getByTestId('task-frame').getByRole('link', { name: 'Incidents', exact: true }))
      .toHaveAttribute('aria-current', 'page');
  });

  test('a record is found in its group and opens its detail page', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    await page.getByPlaceholder('Search tasks and records...').fill('Gate Org');

    const organizations = page.getByTestId('search-group-organization');
    await expect(organizations.getByText('Organizations', { exact: true })).toBeVisible();
    await organizations.getByRole('button', { name: 'Gate Org A', exact: true }).click();

    await expect(page).toHaveURL(/\/tasks\/workers\/organizations\/[\w-]{22}$/);
  });

  test('a kind the bar could not reach before is found: incidents', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    await page.getByPlaceholder('Search tasks and records...').fill('synthetic incident');
    const incidents = page.getByTestId('search-group-incident');
    await expect(incidents.getByText('Incidents', { exact: true })).toBeVisible();
    await expect(incidents.getByRole('button').first()).toContainText('synthetic incident');
  });
});
