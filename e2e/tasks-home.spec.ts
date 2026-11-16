import { test, expect, request, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { API_URL } from './env';
import { metricValue } from '../lib/tasks/metrics';
import type { TaskMetrics } from '../lib/types/tasks';

/**
 * Tasks 3 (TODO00000140): the home page, a person's own pins and recents, the
 * landing rule, and the customization part of a user's profile, which an admin
 * sets on the account page. The specs act as the synthetic admin, who is also a
 * user with every task. Each spec leaves the pins and the profile as it found them.
 *
 * Changed with the catalog v3 (TODO00000140 A14, lane F1): tasks with
 * views (24 since View Usages) in place of 63 pages, grouped by grouping; the start task is a code;
 * the global sidebar gave way to the task frame.
 *
 * Changed with the home face-lift (feat/home-search-light): a greeting in place
 * of the "Home" title, one Pinned row that mixes the person's own pins with the
 * tasks an admin set, every other task under its grouping, and key metrics on
 * the cards.
 *
 * Changed with View Usages (feat/view-usages): the 24th task, which the admin has.
 */

/** The backend, as the signed-in person. */
async function backend(context: BrowserContext): Promise<APIRequestContext> {
  const session = (await context.cookies()).find((c) => c.name === 'it_aware_access');
  expect(session).toBeTruthy();
  return request.newContext({ extraHTTPHeaders: { Cookie: `it_aware_access=${session!.value}` } });
}

async function ownAccountOid(context: BrowserContext): Promise<string> {
  const api = await backend(context);
  const me = await api.get(`${API_URL}/auth/me`);
  expect(me.ok()).toBeTruthy();
  const oid = (await me.json()).account.oid as string;
  await api.dispose();
  return oid;
}

/** Open the home page; while it streams in its markup is briefly there twice. */
async function openHome(page: Page) {
  await page.goto('/home');
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('home-greeting')).toHaveCount(1);
}

/** Open a user's account page and wait until it is there once, with its requests done. */
async function openAccount(page: Page, oid: string) {
  await page.goto(`/tasks/access/accounts/${oid}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('profile-customization')).toHaveCount(1);
}

test.describe('Tasks 3: home, pins and the user profile', () => {
  test('with no start page set, a person lands on the home with their tasks', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/home$/);
    // The home greets the person by the time of day, with today's date.
    await expect(page.getByTestId('home-greeting')).toHaveText(/^Good (morning|afternoon|evening)$/);
    await expect(page.getByTestId('home-date')).toHaveText(/^\w+day, \w+ \d{1,2}$/);

    // Nothing is pinned or set by an admin, so the Pinned row is empty; the rest are shown.
    await expect(page.getByTestId('home-set-for-you')).toHaveCount(0);
    await expect(page.getByTestId('home-pinned').getByText('Pin a task below or from search.')).toBeVisible();
    const other = page.getByTestId('home-other');
    await expect(other.getByRole('link', { name: 'Maintain IT Service Catalog', exact: true })).toHaveAttribute('href', '/tasks/it-service-catalog/service-catalogs');
    // The task kinds are named Internal Task and External Task (maintainer, 2026-11-12:
    // "rename thoroughly the task kind: Internal Task, External Task").
    await expect(other.getByText('Internal Task').first()).toBeVisible();
    // The other tasks are under their groupings, in catalog order.
    await expect(other.getByRole('heading', { level: 2 })).toHaveText(
      [/^All tasks · Data/, /^All tasks · Analytics/, /^All tasks · Operations/, /^All tasks · Administration/]
    );
    await expect(page.getByTestId('home-grouping-analytics').getByRole('link', { name: 'Persona Dashboard', exact: true })).toBeVisible();

    // The top bar reaches the home from any page.
    await page.goto('/tasks/workers/workers');
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test('the top bar has no menu; its pages are reached as tasks, each with its own views', async ({ page }) => {
    await page.goto('/tasks/workers/workers');
    const topBar = page.locator('header').filter({ visible: true }).last();
    await expect(topBar.getByRole('link', { name: /IT-Aware/ })).toHaveAttribute('href', '/');
    await expect(topBar.getByPlaceholder('Search tasks and records...')).toBeVisible();
    // The retired entries: none is a link or a button in the top bar any more.
    for (const entry of ['Auth', 'Data', 'Persona', 'ITOps Dashboard', 'Ohla Chatbot', 'Ohla Journey', 'SSC Team', 'Systems', 'Other Apps']) {
      await expect(topBar.getByRole('link', { name: entry, exact: true })).toHaveCount(0);
      await expect(topBar.getByRole('button', { name: entry, exact: true })).toHaveCount(0);
    }
    await expect(topBar.getByRole('navigation')).toHaveCount(0);
    // No global sidebar: the task's views are its tabs.
    await expect(page.locator('aside')).toHaveCount(0);
    await expect(page.getByTestId('task-frame').getByRole('link', { name: 'Organizations', exact: true })).toHaveAttribute('href', '/tasks/workers/organizations');

    // A page a retired entry opened is a task on the home: Persona, and the first page of Auth.
    await openHome(page);
    const other = page.getByTestId('home-other');
    await expect(other.getByRole('link', { name: 'Maintain Access', exact: true })).toHaveAttribute('href', '/tasks/access/accounts');
    await expect(other.locator('a[href="/tasks/persona-dashboard"]')).toHaveCount(1);
    await expect(other.locator('a[href="/tasks/it-knowledge/library"]')).toHaveCount(1);
    await expect(other.locator('a[href="/tasks/data-overview"]')).toHaveCount(1);
  });

  test("a task's page shows the task frame: its name, grouping, views and pin", async ({ page }) => {
    await page.goto('/tasks/it-tickets/vip');
    const frame = page.getByTestId('task-frame');
    await expect(frame.getByTestId('task-frame-name')).toHaveText('Monitor IT Tickets');
    await expect(frame.getByText('Operations', { exact: true })).toBeVisible();
    const views = frame.getByRole('navigation', { name: 'Views of Monitor IT Tickets' });
    await expect(views.getByRole('link')).toHaveText(
      ['Active Monitoring', 'Incidents', 'Catalog', 'VIP Tickets', 'Unassigned', 'On/Offboarding']
    );
    await expect(views.getByRole('link', { name: 'VIP Tickets' })).toHaveAttribute('aria-current', 'page');
    await views.getByRole('link', { name: 'Unassigned' }).click();
    await expect(page).toHaveURL(/\/tasks\/it-tickets\/unassigned$/);
    await expect(views.getByRole('link', { name: 'Unassigned' })).toHaveAttribute('aria-current', 'page');

    // Pinned from the frame, it is on the home; unpinned from the frame, it is gone.
    await frame.getByRole('button', { name: 'Pin to home', exact: true }).click();
    await expect(frame.getByRole('button', { name: 'Unpin from home', exact: true })).toBeVisible();
    // The frame's pin is the star of the home and of search: filled once pinned.
    await expect(frame.getByRole('button', { name: 'Unpin from home', exact: true }).locator('svg.lucide-star')).toHaveAttribute('fill', 'currentColor');
    await openHome(page);
    const pinned = page.getByTestId('home-pinned');
    await expect(pinned.getByRole('link', { name: 'Monitor IT Tickets', exact: true })).toHaveAttribute('href', '/tasks/it-tickets/active');
    await page.goto('/tasks/it-tickets/active');
    await page.getByTestId('task-frame').getByRole('button', { name: 'Unpin from home', exact: true }).click();
    await expect(page.getByTestId('task-frame').getByRole('button', { name: 'Pin to home', exact: true })).toBeVisible();
    await openHome(page);
    await expect(pinned.getByRole('link', { name: 'Monitor IT Tickets', exact: true })).toHaveCount(0);
  });

  test('a task with one view has no tabs, and the home is no task', async ({ page }) => {
    await page.goto('/tasks/it-incidents');
    const frame = page.getByTestId('task-frame');
    await expect(frame.getByTestId('task-frame-name')).toHaveText('View IT Incidents');
    await expect(frame.getByRole('navigation')).toHaveCount(0);
    await openHome(page);
    await expect(page.getByTestId('task-frame')).toHaveCount(0);
  });

  test('a task is pinned and unpinned from the home', async ({ page }) => {
    await openHome(page);
    const pinned = page.getByTestId('home-pinned');
    const other = page.getByTestId('home-other');

    const task = 'Maintain Workers and Organizations';
    await other.getByRole('button', { name: `Pin ${task}`, exact: true }).click();
    await expect(pinned.getByRole('link', { name: task, exact: true })).toBeVisible();
    await expect(other.getByRole('link', { name: task, exact: true })).toHaveCount(0);

    // It is still pinned after a reload: the pin is stored, not kept in the page.
    await openHome(page);
    await expect(pinned.getByRole('link', { name: task, exact: true })).toBeVisible();

    await pinned.getByRole('button', { name: `Unpin ${task}`, exact: true }).click();
    await expect(pinned.getByRole('link', { name: task, exact: true })).toHaveCount(0);
    await expect(other.getByRole('link', { name: task, exact: true })).toBeVisible();
  });

  test('a task is pinned from search, and shows on the home', async ({ page }) => {
    await openHome(page);
    await page.getByPlaceholder('Search tasks and records...').fill('service cat');
    const tasks = page.getByTestId('search-group-task');
    const task = 'Maintain IT Service Catalog';
    // The bar shows the pin at once; wait until the backend has it before leaving the page.
    const saved = page.waitForResponse(
      (response) => response.request().method() === 'POST' && 'next-action' in response.request().headers()
    );
    await tasks.getByRole('button', { name: `Pin ${task}`, exact: true }).click();
    await expect(tasks.getByRole('button', { name: `Unpin ${task}`, exact: true })).toBeVisible();
    await saved;

    await openHome(page);
    const pinned = page.getByTestId('home-pinned');
    await expect(pinned.getByRole('link', { name: task, exact: true })).toBeVisible();

    await pinned.getByRole('button', { name: `Unpin ${task}`, exact: true }).click();
    await expect(pinned.getByRole('link', { name: task, exact: true })).toHaveCount(0);
  });

  test('a task whose page was opened is first under Recent', async ({ page }) => {
    // The page tells the backend it was opened (POST /api/tasks/opened since the fix for task pages that redirect while loading, a
    // server action before); wait for that before leaving it.
    const noted = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/tasks/opened' &&
        response.request().postData() === JSON.stringify({ task: 'workers', view: 'organizations' })
    );
    await page.goto('/tasks/workers/organizations');
    await noted;

    await openHome(page);
    const recent = page.getByTestId('home-recent');
    await expect(recent.getByRole('link').first()).toHaveText('Maintain Workers and Organizations');
    // The home itself is no task, so it never shows under Recent.
    await expect(recent.getByRole('link', { name: 'Home', exact: true })).toHaveCount(0);
  });

  test("an admin sets a user's start page and home tasks; the user lands there and sees them", async ({ page, context }) => {
    const oid = await ownAccountOid(context);
    const card = page.getByTestId('profile-customization');
    const startPage = card.getByLabel('Start page');
    const onHome = card.getByLabel('Data · Maintain Workers and Organizations', { exact: true });

    await openAccount(page, oid);
    await expect(card.getByText('Tasks this user can open (27)')).toBeVisible();
    await expect(card.getByTestId('profile-can-open')).toContainText('Maintain IT Service Catalog');
    // The service line was removed with the catalog v3.
    await expect(card.getByLabel('Service line')).toHaveCount(0);
    await expect(startPage).toHaveValue('');

    try {
      await startPage.selectOption({ label: 'Data · View IT Incidents' });
      await onHome.check();
      await card.getByRole('button', { name: 'Save customization' }).click();
      await expect(card.getByRole('status')).toHaveText('Saved');

      // The user lands on the start page, and the home's Pinned row shows what the
      // admin set, labelled "Set for you" and with no pin on it.
      await page.goto('/');
      await expect(page).toHaveURL(/\/tasks\/it-incidents$/);
      await openHome(page);
      const adminSet = page.getByTestId('home-pinned').getByTestId('home-card');
      await expect(adminSet).toHaveCount(1);
      await expect(adminSet.getByText('Set for you', { exact: true })).toBeVisible();
      await expect(adminSet.getByRole('link', { name: 'Maintain Workers and Organizations', exact: true })).toBeVisible();
      await expect(adminSet.getByRole('button')).toHaveCount(0);
      await expect(page.getByTestId('home-other').getByRole('link', { name: 'Maintain Workers and Organizations', exact: true })).toHaveCount(0);

      // What was saved is what the admin reads back.
      await openAccount(page, oid);
      await expect(startPage).toHaveValue('it-incidents');
      await expect(onHome).toBeChecked();
    } finally {
      await openAccount(page, oid);
      await startPage.selectOption('');
      await onHome.uncheck();
      await card.getByRole('button', { name: 'Save customization' }).click();
      await expect(card.getByRole('status')).toHaveText('Saved');
    }

    await page.goto('/');
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByTestId('home-set-for-you')).toHaveCount(0);
  });

  test("the Pinned row mixes the person's own pins, first, with the tasks an admin set", async ({ page, context }) => {
    const oid = await ownAccountOid(context);
    const api = await backend(context);
    const profile = `${API_URL}/auth/config/accounts/${oid}/profile`;
    const cards = page.getByTestId('home-pinned').getByTestId('home-card');
    const [catalog, incidents, workers] = ['Maintain IT Service Catalog', 'View IT Incidents', 'Maintain Workers and Organizations'];

    try {
      // An admin set two tasks; the person pinned two, one of them among the admin's.
      expect((await api.put(profile, { data: { start_task: null, home_tasks: ['workers', 'it-incidents'] } })).ok()).toBeTruthy();
      for (const code of ['it-service-catalog', 'it-incidents']) {
        expect((await api.put(`${API_URL}/tasks/pins/${code}`)).ok()).toBeTruthy();
      }

      // Own pins first, in the order pinned, then the admin's; the task in both shows once, as the person's own.
      await openHome(page);
      await expect(cards.getByRole('link')).toHaveText([catalog, incidents, workers]);
      await expect(cards.nth(0).getByRole('button', { name: `Unpin ${catalog}`, exact: true })).toBeVisible();
      await expect(cards.nth(1).getByRole('button', { name: `Unpin ${incidents}`, exact: true })).toBeVisible();
      await expect(cards.nth(2).getByText('Set for you', { exact: true })).toBeVisible();
      await expect(cards.nth(2).getByRole('button')).toHaveCount(0);
      await expect(page.getByTestId('home-set-for-you')).toHaveCount(1);
      // A pinned or admin-set task is not listed again among the others.
      await expect(page.getByTestId('home-other').getByRole('link', { name: incidents, exact: true })).toHaveCount(0);

      // Unpinned, the task in both lists is back at its admin-set place, and cannot be unpinned there.
      await cards.nth(1).getByRole('button', { name: `Unpin ${incidents}`, exact: true }).click();
      await expect(cards.getByRole('link')).toHaveText([catalog, workers, incidents]);
      await expect(cards.nth(2).getByText('Set for you', { exact: true })).toBeVisible();
      await expect(cards.nth(2).getByRole('button')).toHaveCount(0);
    } finally {
      for (const code of ['it-service-catalog', 'it-incidents']) {
        await api.delete(`${API_URL}/tasks/pins/${code}`);
      }
      await api.put(profile, { data: { start_task: null, home_tasks: [] } });
      await api.dispose();
    }

    await openHome(page);
    await expect(cards).toHaveCount(0);
  });

  test("a task's card shows its key metrics: value, period, change, and when it was updated", async ({ page }) => {
    const period = (kind: string) => ({ start: '2026-11-01', end: '2026-11-12', kind });
    const computed_at = new Date(Date.now() - 5 * 60_000).toISOString();
    await page.route('**/api/tasks/metrics', (route) => route.fulfill({ json: { metrics: [
      { task: 'it-incidents', code: 'opened', label: { en: 'opened', zh: '新开' }, unit: 'count', value: 3412, period: period('last_7_days'), previous_value: 3406, computed_at },
      { task: 'it-incidents', code: 'sla', label: { en: 'SLA met', zh: 'SLA 达成' }, unit: 'percent', value: 91.6, period: period('month'), previous_value: 92.8, computed_at },
      { task: 'it-incidents', code: 'third', label: { en: 'a third metric', zh: '第三个' }, unit: 'count', value: 1, period: period('now'), previous_value: null, computed_at },
      { task: 'it-incidents', code: 'fourth', label: { en: 'a fourth metric', zh: '第四个' }, unit: 'count', value: 2, period: period('now'), previous_value: null, computed_at },
      // Data Overview's three (backend cf9f7d3): a 0 is a value like any other.
      { task: 'data-overview', code: 'data-overview.raw', label: { en: 'Raw', zh: '原始' }, unit: 'count', value: 0, period: period('now'), previous_value: null, computed_at },
      { task: 'data-overview', code: 'data-overview.derived', label: { en: 'Derived', zh: '派生' }, unit: 'count', value: 1234567, period: period('now'), previous_value: null, computed_at },
      { task: 'data-overview', code: 'data-overview.transactional', label: { en: 'Transactional', zh: '事务' }, unit: 'count', value: 14769, period: period('now'), previous_value: null, computed_at },
      // Malformed entries are left out; they never break the page.
      { task: 'workers', code: 'no-value', label: { en: 'broken', zh: '坏' }, unit: 'count', value: null, period: period('now'), previous_value: null, computed_at },
      { task: 'workers', code: 'no-period', label: { en: 'broken', zh: '坏' }, unit: 'count', value: 1, previous_value: null, computed_at },
      { task: 'workers', code: 'no-label', unit: 'count', value: 1, period: period('now'), previous_value: null, computed_at },
      { task: 'workers', code: 'no-time', label: { en: 'broken', zh: '坏' }, unit: 'count', value: 1, period: period('now'), previous_value: null, computed_at: 'soon' },
    ] } }));
    await openHome(page);

    // At most three metrics a task (backend cf9f7d3 raised it from two): a count with thousands
    // separators, a percent with one decimal.
    const incidents = page.getByTestId('home-other').locator('[data-task="it-incidents"]').getByTestId('task-metric');
    await expect(incidents).toHaveText([
      /^3,412\s*opened, last 7 days\s*\+6$/,
      /^91\.6%\s*SLA met, this month\s*-1\.2 pts$/,
      /^1\s*a third metric, now$/,
    ]);
    // When the numbers were computed is on the card itself, not only in a tooltip.
    const incidentsRow = page.getByTestId('home-other').locator('[data-task="it-incidents"]');
    await expect(incidentsRow.getByTestId('task-metrics-updated')).toHaveText('Updated 5 minutes ago');
    await expect(incidents.first()).toHaveAttribute('title', 'Updated 5 minutes ago');
    // A large count is written short; without an earlier value there is no change.
    // A 0 is written as 0, not left out.
    const overview = page.getByTestId('home-other').locator('[data-task="data-overview"]').getByTestId('task-metric');
    await expect(overview).toHaveText([/^0\s*Raw, now$/, /^1\.2M\s*Derived, now$/, /^14,769\s*Transactional, now$/]);
    // A task with no metric, or only malformed ones, keeps its plain card.
    await expect(page.getByTestId('home-other').locator('[data-task="workers"]')).toHaveCount(1);
    await expect(page.getByTestId('home-other').locator('[data-task="workers"]').getByTestId('task-metric')).toHaveCount(0);
  });

  for (const status of [500, 401]) {
    test(`the cards stay plain, and the home works, when the metrics call answers ${status}`, async ({ page }) => {
    await page.route('**/api/tasks/metrics', (route) => route.fulfill({ status, json: { metrics: [] } }));
    const failed = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/tasks/metrics');
    await openHome(page);
    expect((await failed).status()).toBe(status);

    await expect(page.getByTestId('task-metric')).toHaveCount(0);
    await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
    const other = page.getByTestId('home-other');
    await expect(other.getByRole('link', { name: 'View IT Incidents', exact: true })).toHaveAttribute('href', '/tasks/it-incidents');
    await expect(other.getByRole('button', { name: 'Pin View IT Incidents', exact: true })).toBeEnabled();
    });
  }

  test("the backend's metrics show on the tasks' cards", async ({ page, context }) => {
    // The hourly job refresh_task_metrics computes the numbers; here the admin asks for the same refresh.
    const api = await backend(context);
    const refreshed = await api.post(`${API_URL}/tasks/metrics/refresh`);
    expect(refreshed.ok()).toBeTruthy();
    expect((await refreshed.json()).refreshed).toContain('it-tickets.active');
    await api.dispose();

    // The home asks for the metrics once, after its cards are drawn.
    const asked: string[] = [];
    page.on('request', (sent) => { if (new URL(sent.url()).pathname === '/api/tasks/metrics') asked.push(sent.url()); });
    const answered = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/tasks/metrics');
    await openHome(page);
    const answer = await answered;
    expect(answer.headers()['cache-control']).toBe('private, no-store');
    const { metrics } = (await answer.json()) as TaskMetrics;
    expect(asked).toHaveLength(1);

    // Monitor IT Tickets shows its two metrics, as the backend answered them: both counts of today.
    const tickets = metrics.filter((metric) => metric.task === 'it-tickets');
    expect(tickets.map((metric) => metric.code)).toEqual(['it-tickets.active', 'it-tickets.unassigned']);
    const shown = page.getByTestId('home-other').locator('[data-task="it-tickets"]').getByTestId('task-metric');
    await expect(shown).toHaveCount(2);
    for (const [index, metric] of tickets.entries()) {
      await expect(shown.nth(index)).toContainText(`${metricValue(metric, 'en')}${metric.label.en}, now`);
      await expect(shown.nth(index)).toHaveAttribute('title', /^Updated (this minute|\d+ minutes? ago)$/);
    }
    await expect(page.getByTestId('home-other').locator('[data-task="it-tickets"]').getByTestId('task-metrics-updated'))
      .toHaveText(/^Updated (this minute|\d+ minutes? ago)$/);
    // Data Overview shows its three, Raw, Derived and Transactional, a 0 among them as 0.
    const layers = metrics.filter((metric) => metric.task === 'data-overview');
    expect(layers.map((metric) => metric.code)).toEqual(['data-overview.raw', 'data-overview.derived', 'data-overview.transactional']);
    const counted = page.getByTestId('home-other').locator('[data-task="data-overview"]').getByTestId('task-metric');
    await expect(counted).toHaveCount(3);
    for (const [index, metric] of layers.entries()) {
      await expect(counted.nth(index)).toContainText(`${metricValue(metric, 'en')}${metric.label.en}, now`);
    }

    // A task the registry has no metric for keeps its plain card.
    expect(metrics.some((metric) => metric.task === 'workers')).toBe(false);
    await expect(page.getByTestId('home-other').locator('[data-task="workers"]').getByTestId('task-metric')).toHaveCount(0);
  });

  test("who has what tasks links a person to their profile page", async ({ page }) => {
    await page.goto('/tasks/access/who-has-what');
    await page.waitForLoadState('networkidle');
    await expect(page.getByPlaceholder('Filter…')).toHaveCount(1);
    await page.getByRole('tab', { name: 'By person' }).click();
    await page.getByPlaceholder('Filter…').fill('gate.alice');
    await page.getByTestId('task-holders').getByRole('button', { name: /gate\.alice/ }).click();
    await page.getByRole('link', { name: 'User profile: gate.alice' }).click();

    await expect(page).toHaveURL(/\/tasks\/access\/accounts\/[\w-]{22}$/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-customization')).toHaveCount(1);
    await expect(page.getByTestId('profile-customization').getByText('Tasks this user can open (27)')).toBeVisible();
  });
});
