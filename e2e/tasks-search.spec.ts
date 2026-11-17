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
    await expect(page.getByTestId('task-views').getByRole('link', { name: 'Incidents', exact: true }))
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
    // "/" puts the cursor in the box from anywhere on the page. The page listens for the
    // key once it has hydrated, which can be after goto returns: press until it is taken.
    await expect(async () => {
      await page.keyboard.press('/');
      await expect(box).toBeFocused({ timeout: 500 });
    }).toPass({ timeout: 10_000 });
    await expect(box).toHaveValue('');
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
    // For a screen reader the box is a combobox, the panel its listbox, the selected result its active option.
    await expect(box).toHaveRole('combobox');
    await expect(box).toHaveAttribute('aria-expanded', 'true');
    await expect(results).toHaveRole('listbox');
    expect(await box.getAttribute('aria-controls')).toBe(await results.getAttribute('id'));
    const selected = results.getByRole('option', { selected: true });
    await expect(selected).toHaveCount(1);
    expect(await box.getAttribute('aria-activedescendant')).toBe(await selected.getAttribute('id'));
    await expect(results.getByRole('group', { name: 'Tasks', exact: true }).getByRole('option')).toHaveCount(await tasks.count());
    await expect(results.getByRole('group', { name: 'Objects: Incidents', exact: true })).toHaveCount(1);
    const taskCount = await tasks.count();
    expect(taskCount).toBeGreaterThan(1);
    for (let moved = 0; moved < taskCount; moved += 1) await box.press('ArrowDown');
    await expect(objects.getByTestId('search-hit').first()).toHaveAttribute('data-active', 'true');
    await expect(objects.getByTestId('search-hit').first()).toHaveAttribute('aria-selected', 'true');
    expect(await box.getAttribute('aria-activedescendant')).toBe(await objects.getByTestId('search-hit').first().getAttribute('id'));
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
    await expect(box).toHaveAttribute('aria-expanded', 'false');

    // A query of spaces around one letter is one letter: too short to search, so no panel.
    await box.fill('  i  ');
    await expect(box).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('No results found')).toHaveCount(0);
  });

  test('"/" is typed, not taken, inside a field', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    const filter = page.getByPlaceholder('Search workers...');
    await filter.click();
    await page.keyboard.type('a/b');
    await expect(filter).toHaveValue('a/b');
    await expect(filter).toBeFocused();
    // In the search box itself too.
    const box = page.getByPlaceholder('Search tasks and records...');
    await box.click();
    await page.keyboard.type('x/y');
    await expect(box).toHaveValue('x/y');
  });

  test('a pin made in the panel holds when the panel closes and opens again; Esc closes from inside it', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    const box = page.getByPlaceholder('Search tasks and records...');
    const tasks = page.getByTestId('search-group-task');
    const task = 'Maintain IT Service Catalog';
    const saved = () => page.waitForResponse(
      (response) => response.request().method() === 'POST' && 'next-action' in response.request().headers()
    );
    await box.fill('service cat');

    try {
      let done = saved();
      await tasks.getByRole('button', { name: `Pin ${task}`, exact: true }).click();
      await expect(tasks.getByRole('button', { name: `Unpin ${task}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await done;

      // Closed by a click outside and opened again on the same results: the star is still filled ...
      await page.getByTestId('task-frame-name').click();
      await expect(page.getByTestId('search-results')).toHaveCount(0);
      await box.focus();
      await expect(tasks.getByRole('button', { name: `Unpin ${task}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(tasks.getByRole('button', { name: `Pin ${task}`, exact: true })).toHaveCount(0);

      // ... and the next click unpins, as it says.
      done = saved();
      await tasks.getByRole('button', { name: `Unpin ${task}`, exact: true }).click();
      await expect(tasks.getByRole('button', { name: `Pin ${task}`, exact: true })).toHaveAttribute('aria-pressed', 'false');
      await done;
      await page.getByTestId('task-frame-name').click();
      await box.focus();
      await expect(tasks.getByRole('button', { name: `Pin ${task}`, exact: true })).toHaveAttribute('aria-pressed', 'false');

      // With the focus on a pin button inside the panel, Esc still closes it.
      await tasks.getByRole('button', { name: `Pin ${task}`, exact: true }).focus();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('search-results')).toHaveCount(0);
      await expect(box).toHaveValue('');
    } finally {
      await page.goto('/tasks/it-service-catalog/service-catalogs');
      const unpin = page.getByTestId('task-frame').getByRole('button', { name: 'Unpin from home', exact: true });
      if (await unpin.count()) {
        await unpin.click();
        await expect(page.getByTestId('task-frame').getByRole('button', { name: 'Pin to home', exact: true })).toBeVisible();
      }
    }
  });

  test('a pin that fails is put back, and the panel says so', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    const box = page.getByPlaceholder('Search tasks and records...');
    const tasks = page.getByTestId('search-group-task');
    const task = 'Maintain IT Service Catalog';
    await box.fill('service cat');
    await expect(tasks.getByRole('button', { name: `Pin ${task}`, exact: true })).toBeVisible();

    // The pin's request never reaches the server.
    await page.route('**/*', (route) => ('next-action' in route.request().headers() ? route.abort() : route.continue()));
    await tasks.getByRole('button', { name: `Pin ${task}`, exact: true }).click();
    await expect(page.getByTestId('search-pin-failed')).toHaveText('The pin could not be changed. Try again.');
    await expect(tasks.getByRole('button', { name: `Pin ${task}`, exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.unroute('**/*');

    // A new query clears the message.
    await box.fill('service cata');
    await expect(tasks.getByRole('button', { name: `Pin ${task}`, exact: true })).toBeVisible();
    await expect(page.getByTestId('search-pin-failed')).toHaveCount(0);
  });

  test('a search that fails says so, and is not "no results"', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    const box = page.getByPlaceholder('Search tasks and records...');
    await page.route('**/api/search*', (route) => route.fulfill({ status: 502, json: { groups: [] } }));
    await box.fill('incid');
    await expect(page.getByTestId('search-failed')).toHaveText('Search failed. Try again.');
    await expect(page.getByText('No results found')).toHaveCount(0);

    // Nothing found is a different line.
    await page.unroute('**/api/search*');
    await box.fill('zzqqxxyy');
    await expect(page.getByText('No results found')).toBeVisible();
    await expect(page.getByTestId('search-failed')).toHaveCount(0);
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
