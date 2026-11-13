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

  test('the panel has two sections, Tasks then Objects, and the keyboard walks both', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    const box = page.getByPlaceholder('Search tasks and records...');
    // "/" puts the cursor in the box from anywhere on the page.
    await page.keyboard.press('/');
    await expect(box).toBeFocused();
    await box.fill('incid');

    const results = page.getByTestId('search-results');
    await expect(results.getByRole('heading', { level: 3 })).toHaveText([/^Tasks\s*\d+ you can open$/, /^Objects\s*records you can see$/]);
    const tasks = page.getByTestId('search-group-task').getByTestId('search-hit');
    const objects = page.getByTestId('search-objects');
    // The records are under a small heading per kind, with its count.
    const incidents = objects.getByTestId('search-group-incident');
    await expect(incidents.getByRole('heading', { level: 4 })).toHaveText(/^Incidents · \d+$/);
    await expect(incidents.getByTestId('search-hit').first()).toContainText('incident');

    // The first result is where the keys start; the arrows move through the tasks and on into the objects.
    const active = results.locator('[data-testid="search-hit"][data-active="true"]');
    await expect(active).toHaveCount(1);
    await expect(tasks.first()).toHaveAttribute('data-active', 'true');
    const taskCount = await tasks.count();
    expect(taskCount).toBeGreaterThan(1);
    for (let moved = 0; moved < taskCount; moved += 1) await box.press('ArrowDown');
    await expect(objects.getByTestId('search-hit').first()).toHaveAttribute('data-active', 'true');
    await box.press('ArrowUp');
    await expect(tasks.last()).toHaveAttribute('data-active', 'true');
    // Up from the first result goes round to the last one.
    for (let moved = 1; moved < taskCount; moved += 1) await box.press('ArrowUp');
    await expect(tasks.first()).toHaveAttribute('data-active', 'true');
    await box.press('ArrowUp');
    await expect(results.getByTestId('search-hit').last()).toHaveAttribute('data-active', 'true');
    await expect(active).toHaveCount(1);

    // Esc closes the panel and empties the box.
    await box.press('Escape');
    await expect(results).toHaveCount(0);
    await expect(box).toHaveValue('');
  });

  test('Enter opens the result the arrow keys are on: a task, then a record', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    const box = page.getByPlaceholder('Search tasks and records...');
    await box.fill('incid');
    const tasks = page.getByTestId('search-group-task').getByTestId('search-hit');
    await expect(tasks.first()).toHaveAttribute('data-active', 'true');
    // The second task is Monitor IT Tickets, found through its Incidents view: Enter opens that exact tab.
    await box.press('ArrowDown');
    await expect(tasks.nth(1)).toHaveAttribute('data-active', 'true');
    await expect(tasks.nth(1)).toContainText('Monitor IT Tickets');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/tasks\/it-tickets\/incidents$/);
    await expect(page.getByTestId('search-results')).toHaveCount(0);

    await box.fill('incid');
    await expect(tasks.first()).toHaveAttribute('data-active', 'true');
    const taskCount = await tasks.count();
    for (let moved = 0; moved < taskCount; moved += 1) await box.press('ArrowDown');
    await expect(page.getByTestId('search-objects').getByTestId('search-hit').first()).toHaveAttribute('data-active', 'true');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/tasks\/it-incidents\/[\w-]{22}$/);
  });

  test('a kind the bar could not reach before is found: incidents', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    await page.getByPlaceholder('Search tasks and records...').fill('synthetic incident');
    const incidents = page.getByTestId('search-group-incident');
    await expect(incidents.getByText('Incidents', { exact: true })).toBeVisible();
    await expect(incidents.getByRole('button').first()).toContainText('synthetic incident');
  });
});
