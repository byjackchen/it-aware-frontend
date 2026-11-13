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

    // The task frame carries its three views as tabs.
    const frame = page.getByTestId('task-frame');
    await expect(frame.getByTestId('task-frame-name')).toHaveText('View Usages');
    const views = frame.getByRole('navigation', { name: 'Views of View Usages' });
    await expect(views.getByRole('link')).toHaveText(['Overview', 'By Task', 'Unused Access']);
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
    await expect(page.getByTestId('usage-tracking-since')).toHaveText(/^Tracking since \d{4}-\d{2}-\d{2}\./);
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

    // A row names its task and links to it, and to its unused access.
    const workers = table.getByTestId('usage-task-row-workers');
    await expect(workers.getByRole('link', { name: 'Maintain Workers and Organizations' })).toHaveAttribute('href', '/tasks/workers/workers');
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

    // The picker names every task of the catalog. It answers once the page has
    // hydrated, which can be after goto returns: pick until the address has the task.
    const picker = page.getByLabel('Task', { exact: true });
    await expect(picker.locator('option')).toHaveCount(TASKS.length + 1);
    await expect(async () => {
      await picker.selectOption('');
      await picker.selectOption({ label: 'Maintain IT Service Catalog' });
      await expect(page).toHaveURL(new RegExp(`${BASE}/unused-access\\?task=it-service-catalog$`), { timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
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

    // A code that is no task of the catalog is no pick.
    await page.goto(`${BASE}/unused-access?task=nowhere`);
    await expect(page.getByText('Pick a task to see who holds it without opening it.')).toBeVisible();
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

    // Each view's address answers with the no-access page.
    for (const view of ['overview', 'tasks', 'unused-access?task=it-incidents']) {
      await page.goto(`${BASE}/${view}`);
      await expect(page).toHaveURL(/\/access-denied$/);
      await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    }
    await context.close();
  });
});
