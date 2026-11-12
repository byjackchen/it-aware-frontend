import { test, expect, request, type BrowserContext, type Page } from '@playwright/test';
import { API_URL } from './env';

/**
 * Tasks 3 (TODO00000140): the home page, a person's own pins and recents, the
 * landing rule, and the customization part of a user's profile, which an admin
 * sets on the account page. The specs act as the synthetic admin, who is also a
 * user with every task. Each spec leaves the pins and the profile as it found them.
 *
 * Changed with the catalog v3 (TODO00000140 A14, lane F1): 23 tasks with
 * views in place of 63 pages, grouped by grouping; the start task is a code;
 * the global sidebar gave way to the task frame.
 */

async function ownAccountOid(context: BrowserContext): Promise<string> {
  const session = (await context.cookies()).find((c) => c.name === 'it_aware_access');
  expect(session).toBeTruthy();
  const api = await request.newContext({ extraHTTPHeaders: { Cookie: `it_aware_access=${session!.value}` } });
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
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toHaveCount(1);
}

/** Open a user's account page and wait until it is there once, with its requests done. */
async function openAccount(page: Page, oid: string) {
  await page.goto(`/auth/accounts/${oid}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('profile-customization')).toHaveCount(1);
}

test.describe('Tasks 3: home, pins and the user profile', () => {
  test('with no start page set, a person lands on the home with their tasks', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { name: 'Home', exact: true })).toHaveCount(1);

    // Nothing is set by an admin, so that part is not shown; the rest are.
    await expect(page.getByTestId('home-adminSet')).toHaveCount(0);
    await expect(page.getByTestId('home-pinned').getByText('Pin a task below or from search.')).toBeVisible();
    const other = page.getByTestId('home-other');
    await expect(other.getByRole('link', { name: 'Maintain IT Service Catalog', exact: true })).toHaveAttribute('href', '/data/service-catalogs');
    await expect(other.getByText('IT-Aware task').first()).toBeVisible();
    // With more than about ten tasks, the others are under their groupings, in catalog order.
    await expect(other.getByRole('heading', { level: 3 })).toHaveText(['Data', 'Analytics', 'Operations', 'Administration']);
    await expect(page.getByTestId('home-grouping-analytics').getByRole('link', { name: 'Persona Dashboard', exact: true })).toBeVisible();

    // The top bar reaches the home from any page.
    await page.goto('/data/workers');
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test('the top bar has no menu; its pages are reached as tasks, each with its own views', async ({ page }) => {
    await page.goto('/data/workers');
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
    await expect(page.getByTestId('task-frame').getByRole('link', { name: 'Organizations', exact: true })).toHaveAttribute('href', '/data/organizations');

    // A page a retired entry opened is a task on the home: Persona, and the first page of Auth.
    await openHome(page);
    const other = page.getByTestId('home-other');
    await expect(other.getByRole('link', { name: 'Maintain Access', exact: true })).toHaveAttribute('href', '/auth/accounts');
    await expect(other.locator('a[href="/persona"]')).toHaveCount(1);
    await expect(other.locator('a[href="/knowledge"]')).toHaveCount(1);
    await expect(other.locator('a[href="/dashboard/data-overview"]')).toHaveCount(1);
  });

  test("a task's page shows the task frame: its name, grouping, views and pin", async ({ page }) => {
    await page.goto('/operation-teams/ops-dashboard/vip-tickets');
    const frame = page.getByTestId('task-frame');
    await expect(frame.getByTestId('task-frame-name')).toHaveText('Monitor IT Tickets');
    await expect(frame.getByText('Operations', { exact: true })).toBeVisible();
    const views = frame.getByRole('navigation', { name: 'Views of Monitor IT Tickets' });
    await expect(views.getByRole('link')).toHaveText(
      ['Active Monitoring', 'Incidents', 'Catalog', 'VIP Tickets', 'Unassigned', 'On/Offboarding']
    );
    await expect(views.getByRole('link', { name: 'VIP Tickets' })).toHaveAttribute('aria-current', 'page');
    await views.getByRole('link', { name: 'Unassigned' }).click();
    await expect(page).toHaveURL(/\/operation-teams\/ops-dashboard\/unassigned$/);
    await expect(views.getByRole('link', { name: 'Unassigned' })).toHaveAttribute('aria-current', 'page');

    // Pinned from the frame, it is on the home; unpinned from the frame, it is gone.
    await frame.getByRole('button', { name: 'Pin to home', exact: true }).click();
    await expect(frame.getByRole('button', { name: 'Unpin from home', exact: true })).toBeVisible();
    await openHome(page);
    const pinned = page.getByTestId('home-pinned');
    await expect(pinned.getByRole('link', { name: 'Monitor IT Tickets', exact: true })).toHaveAttribute('href', '/operation-teams/ops-dashboard');
    await page.goto('/operation-teams/ops-dashboard');
    await page.getByTestId('task-frame').getByRole('button', { name: 'Unpin from home', exact: true }).click();
    await expect(page.getByTestId('task-frame').getByRole('button', { name: 'Pin to home', exact: true })).toBeVisible();
    await openHome(page);
    await expect(pinned.getByRole('link', { name: 'Monitor IT Tickets', exact: true })).toHaveCount(0);
  });

  test('a task with one view has no tabs, and the home is no task', async ({ page }) => {
    await page.goto('/data/incidents');
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
    await tasks.getByRole('button', { name: `Pin ${task}`, exact: true }).click();
    await expect(tasks.getByRole('button', { name: `Unpin ${task}`, exact: true })).toBeVisible();

    await openHome(page);
    const pinned = page.getByTestId('home-pinned');
    await expect(pinned.getByRole('link', { name: task, exact: true })).toBeVisible();

    await pinned.getByRole('button', { name: `Unpin ${task}`, exact: true }).click();
    await expect(pinned.getByRole('link', { name: task, exact: true })).toHaveCount(0);
  });

  test('a task whose page was opened is first under Recent', async ({ page }) => {
    // The page tells the backend it was opened; wait for that before leaving it.
    const noted = page.waitForResponse(
      (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/data/organizations'
    );
    await page.goto('/data/organizations');
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
    await expect(card.getByText('Tasks this user can open (23)')).toBeVisible();
    await expect(card.getByTestId('profile-can-open')).toContainText('Maintain IT Service Catalog');
    // The service line was removed with the catalog v3.
    await expect(card.getByLabel('Service line')).toHaveCount(0);
    await expect(startPage).toHaveValue('');

    try {
      await startPage.selectOption({ label: 'Data · View IT Incidents' });
      await onHome.check();
      await card.getByRole('button', { name: 'Save customization' }).click();
      await expect(card.getByRole('status')).toHaveText('Saved');

      // The user lands on the start page, and the home shows what the admin set, with no pin on it.
      await page.goto('/');
      await expect(page).toHaveURL(/\/data\/incidents$/);
      await openHome(page);
      const adminSet = page.getByTestId('home-adminSet');
      await expect(adminSet.getByText('Set for you by your admin')).toBeVisible();
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
    await expect(page.getByTestId('home-adminSet')).toHaveCount(0);
  });

  test("who has what tasks links a person to their profile page", async ({ page }) => {
    await page.goto('/auth/tasks');
    await page.waitForLoadState('networkidle');
    await expect(page.getByPlaceholder('Filter…')).toHaveCount(1);
    await page.getByRole('tab', { name: 'By person' }).click();
    await page.getByPlaceholder('Filter…').fill('gate.alice');
    await page.getByTestId('task-holders').getByRole('button', { name: /gate\.alice/ }).click();
    await page.getByRole('link', { name: 'User profile: gate.alice' }).click();

    await expect(page).toHaveURL(/\/auth\/accounts\/[\w-]{22}$/);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('profile-customization')).toHaveCount(1);
    await expect(page.getByTestId('profile-customization').getByText('Tasks this user can open (23)')).toBeVisible();
  });
});
