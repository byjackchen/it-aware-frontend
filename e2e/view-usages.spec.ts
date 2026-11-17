import { test, expect, type Locator, type Page } from '@playwright/test';
import { PASSWORD } from './env';
import { TASKS } from '../lib/tasks/catalog';

/**
 * View Usages (feat/view-usages): the Administration task that reads the usage
 * record — sign-ins and opened tasks (backend specs/api_specs_usage.md). The
 * stack records real events: the setup's sign-in, and every task page a spec
 * opens in a browser. The specs act as the synthetic admin, who holds every
 * task; gate.alice (backend ci/e2e/seed.py, group gate-readers) holds every
 * task too and never opens one in a browser; ohla-drift-admin holds only
 * objects:interactions:read, so not this task.
 */

const BASE = '/tasks/usages';

/** Open one of the task's views and wait until it is there once, with its requests done. */
async function open(page: Page, path: string, heading: string) {
  await page.goto(`${BASE}/${path}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toHaveCount(1);
}

/** Open a task's page, and wait until the frame has told the backend it was opened. */
async function openTask(page: Page, address: string) {
  await page.goto(address);
  await expect(page.getByTestId('task-frame')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

/** The number a stat tile shows. */
async function stat(page: Page, key: string): Promise<number> {
  const text = await page.getByTestId(`usage-stat-${key}`).locator('p').nth(1).innerText();
  return Number(text.replace(/,/g, ''));
}

/** The numbers of one column of the By Task table, top to bottom. */
async function column(cells: Locator): Promise<number[]> {
  return (await cells.allInnerTexts()).map((text) => Number(text.replace(/,/g, '')));
}

test.describe('View Usages', () => {
  test('a holder finds the task on the home and in search', async ({ page }) => {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('home-greeting')).toHaveCount(1);
    await expect(
      page.getByTestId('home-grouping-administration').getByRole('link', { name: 'View Usages', exact: true }),
    ).toHaveAttribute('href', `${BASE}/overview`);

    await page.getByPlaceholder('Search tasks and records...').fill('view usages');
    await page.getByTestId('search-group-task').getByRole('button', { name: 'View Usages Administration', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/overview$`));

    // The task frame carries its four views as tabs (By Person since the contract
    // copy of backend 358c5ef, feat/usage-who-icons).
    const frame = page.getByTestId('task-frame');
    await expect(frame.getByTestId('task-frame-name')).toHaveText('View Usages');
    const views = page.getByTestId('task-views').getByRole('navigation', { name: 'Views of View Usages' });
    await expect(views.getByRole('link')).toHaveText(['Overview', 'By Task', 'By Person', 'Unused Access']);
    await expect(views.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    await expect(views.getByRole('link', { name: 'By Task' })).toHaveAttribute('href', `${BASE}/tasks`);
  });

  test('the overview counts the people, sign-ins and opened tasks, in the window picked', async ({ page }) => {
    // Real events first: two tasks opened, each at one of its views.
    await openTask(page, '/tasks/workers/organizations');
    await openTask(page, '/tasks/it-tickets/vip');

    await open(page, 'overview', 'Overview');
    // The setup signed the admin in, and the pages above were opened today.
    expect(await stat(page, 'activeToday')).toBeGreaterThanOrEqual(1);
    expect(await stat(page, 'activeLast7')).toBeGreaterThanOrEqual(1);
    expect(await stat(page, 'signIns')).toBeGreaterThanOrEqual(1);
    expect(await stat(page, 'taskOpens')).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId('usage-stat-activeWindow')).toContainText('Active people, last 30 days');
    await expect(page.getByTestId('usage-tracking-since')).toHaveText(/^Tracking since \d{4}-\d{2}-\d{2} \(UTC day\)\./);
    await expect(page.getByTestId('usage-stat-activeToday')).toContainText('Active people today (UTC)');
    await expect(page.getByTestId('usage-empty')).toHaveCount(0);
    // The daily chart draws its two series.
    const chart = page.getByTestId('usage-daily-chart');
    await expect(chart.getByText('Daily activity')).toBeVisible();
    await expect(chart.locator('.recharts-line')).toHaveCount(2);

    // The window is in the address: 30 days unless picked.
    const windows = page.getByRole('navigation', { name: 'Window' });
    await expect(windows.getByRole('link')).toHaveText(['7 days', '30 days', '90 days']);
    await expect(windows.getByRole('link', { name: '30 days' })).toHaveAttribute('aria-current', 'page');
    await windows.getByRole('link', { name: '7 days' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/overview\\?days=7$`));
    await expect(windows.getByRole('link', { name: '7 days' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('usage-stat-activeWindow')).toContainText('Active people, last 7 days');
    await expect(page.getByTestId('usage-window')).toHaveText(/^\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2} \(UTC days\)$/);
    expect(await stat(page, 'taskOpens')).toBeGreaterThanOrEqual(2);

    // The task's tabs carry the window along; the default one is left out of the address.
    const views = page.getByTestId('task-views').getByRole('navigation', { name: 'Views of View Usages' });
    await expect(views.getByRole('link', { name: 'Unused Access' })).toHaveAttribute('href', `${BASE}/unused-access?days=7`);
    await views.getByRole('link', { name: 'By Task' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/tasks\\?days=7$`));
    await expect(windows.getByRole('link', { name: '7 days' })).toHaveAttribute('aria-current', 'page');
    await windows.getByRole('link', { name: '30 days' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/tasks$`));
    await expect(views.getByRole('link', { name: 'Overview' })).toHaveAttribute('href', `${BASE}/overview`);
  });

  test("moving between a view's records is one open; another view is another", async ({ page }) => {
    // What the frame tells the backend: one POST /api/tasks/opened per open, with the task and
    // the view (a server action until the fix for task pages that redirect while loading).
    const told: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/tasks/opened') told.push(request.postData() ?? '');
    });
    const opens = (task: string, view: string) => told.filter((body) => body === JSON.stringify({ task, view })).length;

    await openTask(page, '/tasks/workers/organizations');
    await expect.poll(() => opens('workers', 'organizations')).toBe(1);

    // To a record of the same view, without a page load: still the one open.
    await page.getByPlaceholder('Search tasks and records...').fill('Gate Org');
    await page.getByTestId('search-group-organization').getByRole('button', { name: 'Gate Org A', exact: true }).click();
    await expect(page).toHaveURL(/\/tasks\/workers\/organizations\/[\w-]{22}$/);
    await page.waitForLoadState('networkidle');
    // And back to the list, by the frame's own tab.
    const views = page.getByTestId('task-views').getByRole('navigation', { name: 'Views of Maintain Workers and Organizations' });
    await views.getByRole('link', { name: 'Organizations' }).click();
    await expect(page).toHaveURL(/\/tasks\/workers\/organizations$/);
    await page.waitForLoadState('networkidle');
    expect(opens('workers', 'organizations')).toBe(1);

    // Another view of the task is another open.
    await views.getByRole('link', { name: 'Locations' }).click();
    await expect(page).toHaveURL(/\/tasks\/workers\/locations$/);
    await expect.poll(() => opens('workers', 'locations')).toBe(1);
    expect(opens('workers', 'organizations')).toBe(1);
  });

  test('by task: every task, opens first; sortable; filtered to the ones nobody opened', async ({ page }) => {
    await openTask(page, '/tasks/workers/organizations');
    await open(page, 'tasks', 'By Task');
    const table = page.getByTestId('usage-tasks-table');
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(TASKS.length);
    await expect(page.getByText(`${TASKS.length} of ${TASKS.length} tasks`)).toBeVisible();

    // The default order: the most opened first.
    await expect(table.getByRole('columnheader', { name: 'Opens' })).toHaveAttribute('aria-sort', 'descending');
    const opens = await column(table.getByTestId('usage-task-opens'));
    expect(opens).toEqual([...opens].sort((a, b) => b - a));
    expect(opens[0]).toBeGreaterThanOrEqual(1);

    // A row names its task and links to it, and to its unused access. (Exact: since 799680e
    // its People number is a link too, named "<n> people opened <task>".)
    const workers = table.getByTestId('usage-task-row-workers');
    await expect(workers.getByRole('link', { name: 'Maintain Workers and Organizations', exact: true })).toHaveAttribute(
      'href',
      '/tasks/workers/workers',
    );
    await expect(workers).toContainText('Data');
    expect(Number(await workers.getByTestId('usage-task-opens').innerText())).toBeGreaterThanOrEqual(1);
    await expect(workers.getByTestId('usage-task-share')).toHaveText(/^\d{1,3}%$/);
    await expect(workers).not.toContainText('Never');
    await expect(workers.getByRole('link', { name: 'Unused access' })).toHaveAttribute('href', `${BASE}/unused-access?task=workers`);

    // Sorted by name: A to Z, then Z to A. The table sorts once the page has
    // hydrated, which can be after goto returns: click until it has.
    const byName = table.getByRole('columnheader', { name: 'Task' });
    await expect(async () => {
      await byName.getByRole('button').click();
      await expect(byName).toHaveAttribute('aria-sort', 'ascending', { timeout: 500 });
    }).toPass({ timeout: 10_000 });
    const names = TASKS.map((task) => task.name.en).sort((a, b) => a.localeCompare(b));
    await expect(rows.first().getByRole('link').first()).toHaveText(names[0]);
    await expect(rows.last().getByRole('link').first()).toHaveText(names[names.length - 1]);
    await byName.getByRole('button').click();
    await expect(byName).toHaveAttribute('aria-sort', 'descending');
    await expect(rows.first().getByRole('link').first()).toHaveText(names[names.length - 1]);

    // Only the tasks nobody opened in the window: the one opened above is not among them.
    await page.getByLabel('Never opened in the window').check();
    await expect(table.getByTestId('usage-task-row-workers')).toHaveCount(0);
    const unopened = await column(table.getByTestId('usage-task-opens'));
    expect(unopened.every((count) => count === 0)).toBe(true);
    await expect(page.getByText(`${unopened.length} of ${TASKS.length} tasks`)).toBeVisible();

    // From a row to its unused access, the window kept.
    await page.getByLabel('Never opened in the window').uncheck();
    await page.goto(`${BASE}/tasks?days=7`);
    await page
      .getByTestId('usage-task-row-it-service-catalog')
      .getByRole('link', { name: 'Unused access' })
      .click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/unused-access\\?task=it-service-catalog&days=7$`));
    await expect(page.getByTestId('unused-summary')).toHaveText(/^\d+ of \d+ holders did not open it in the last 7 days$/);
  });

  test('unused access lists a holder who never opened the task', async ({ page }) => {
    await open(page, 'unused-access', 'Unused Access');
    await expect(page.getByText('Pick a task to see who holds it without opening it.')).toBeVisible();
    await expect(page.getByTestId('unused-summary')).toHaveCount(0);

    // The picker names every task of the catalog. Choosing one asks for nothing:
    // the list is read on Show (a form the browser sends itself).
    const picker = page.getByRole('combobox', { name: 'Task', exact: true });
    await expect(picker.locator('option')).toHaveCount(TASKS.length + 1);
    await picker.selectOption({ label: 'Maintain IT Service Catalog' });
    await expect(page).toHaveURL(new RegExp(`${BASE}/unused-access$`));
    await page.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/unused-access\\?task=it-service-catalog$`));
    await expect(picker).toHaveValue('it-service-catalog');

    // gate.alice holds the task (gate-readers) and never opened it.
    const summary = page.getByTestId('unused-summary');
    await expect(summary).toHaveText(/^\d+ of \d+ holders did not open it in the last 30 days$/);
    const [total, holders] = (await summary.innerText()).match(/\d+/g)!.map(Number);
    expect(total).toBeGreaterThanOrEqual(1);
    expect(holders).toBeGreaterThanOrEqual(total);
    await expect(page.getByText('People who lost access to the task are not listed.')).toBeVisible();
    const alice = page.getByTestId('unused-table').locator('tbody tr').filter({ hasText: 'gate.alice' });
    await expect(alice).toHaveCount(1);
    await expect(alice).toContainText('Never');
    await expect(alice.getByRole('link', { name: 'gate.alice', exact: true })).toHaveAttribute(
      'href',
      /^\/tasks\/access\/accounts\/[\w-]{22}$/,
    );

    // The window changes with the task kept.
    await page.getByRole('navigation', { name: 'Window' }).getByRole('link', { name: '90 days' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/unused-access\\?task=it-service-catalog&days=90$`));
    await expect(summary).toHaveText(/did not open it in the last 90 days$/);

    // Show keeps the window picked.
    await picker.selectOption({ label: 'Manage Jobs' });
    await page.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/unused-access\\?task=jobs&days=90$`));

    // A page past the end is the last page, whatever the address says.
    await page.goto(`${BASE}/unused-access?task=it-service-catalog&page=99999999999`);
    await expect(page).toHaveURL(new RegExp(`${BASE}/unused-access\\?task=it-service-catalog$`));
    await expect(page.getByTestId('unused-table').locator('tbody tr').filter({ hasText: 'gate.alice' })).toHaveCount(1);
    // The page replaced its address; let that navigation end before the next one,
    // or Chromium aborts the next goto (net::ERR_ABORTED, seen 2026-11-16).
    await page.waitForLoadState('networkidle');

    // A code that is no task of the catalog is no pick.
    // (While a page streams in, its markup is briefly there twice: open() waits for the one page.)
    await open(page, 'unused-access?task=nowhere', 'Unused Access');
    await expect(page.getByText('Pick a task to see who holds it without opening it.')).toBeVisible();
    await expect(page.getByTestId('unused-summary')).toHaveCount(0);
  });

  test('a person without the permission does not see the task, and gets no access at its address', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/auth/login');
    await page.locator('#username').fill('ohla-drift-admin');
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: /^Login$/ }).click();
    // The landing first: a navigation started before it would race the login's own.
    await page.waitForURL(/\/home$/, { timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('home-greeting')).toHaveCount(1);

    // Not on the home, and not in search.
    await expect(page.getByRole('link', { name: 'View Usages', exact: true })).toHaveCount(0);
    const box = page.getByPlaceholder('Search tasks and records...');
    await box.fill('view usages');
    // The search has answered: nothing found, or results without the task.
    await expect(page.getByText('No results found').or(page.getByTestId('search-results'))).toBeVisible();
    await expect(page.getByRole('button', { name: /View Usages/ })).toHaveCount(0);

    // Each view's address, and each sub-page's (a task's people, one person), answers with the
    // no-access page, with or without a task picked.
    for (const view of [
      'overview',
      'tasks',
      'tasks/it-incidents',
      'tasks/nowhere',
      'people',
      'people/QUFBQUFBQUFBQUFBQUFBQQ',
      'unused-access',
      'unused-access?task=nowhere',
      'unused-access?task=it-incidents',
    ]) {
      await page.goto(`${BASE}/${view}`);
      await expect(page).toHaveURL(/\/access-denied$/);
      await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    }
    await context.close();
  });
});
