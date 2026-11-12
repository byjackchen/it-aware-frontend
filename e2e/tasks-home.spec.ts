import { test, expect, request, type BrowserContext, type Page } from '@playwright/test';
import { API_URL } from './env';

/**
 * Tasks 3 (TODO00000140): the home page, a person's own pins and recents, the
 * landing rule, and the customization part of a user's profile, which an admin
 * sets on the account page. The specs act as the synthetic admin, who is also a
 * user with every task. Each spec leaves the pins and the profile as it found them.
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
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toHaveCount(1);
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
    await expect(other.getByRole('link', { name: 'Service Catalogs', exact: true })).toHaveAttribute('href', '/data/service-catalogs');
    await expect(other.getByText('IT-Aware task').first()).toBeVisible();

    // The top bar reaches the home from any page.
    await page.goto('/data/workers');
    await page.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test('a task is pinned and unpinned from the home', async ({ page }) => {
    await openHome(page);
    const pinned = page.getByTestId('home-pinned');
    const other = page.getByTestId('home-other');

    await other.getByRole('button', { name: 'Pin Locations', exact: true }).click();
    await expect(pinned.getByRole('link', { name: 'Locations', exact: true })).toBeVisible();
    await expect(other.getByRole('link', { name: 'Locations', exact: true })).toHaveCount(0);

    // It is still pinned after a reload: the pin is stored, not kept in the page.
    await openHome(page);
    await expect(pinned.getByRole('link', { name: 'Locations', exact: true })).toBeVisible();

    await pinned.getByRole('button', { name: 'Unpin Locations', exact: true }).click();
    await expect(pinned.getByRole('link', { name: 'Locations', exact: true })).toHaveCount(0);
    await expect(other.getByRole('link', { name: 'Locations', exact: true })).toBeVisible();
  });

  test('a task is pinned from search, and shows on the home', async ({ page }) => {
    await openHome(page);
    await page.getByPlaceholder('Search Data Objects...').fill('service cat');
    const tasks = page.getByTestId('search-group-task');
    await tasks.getByRole('button', { name: 'Pin Service Catalogs', exact: true }).click();
    await expect(tasks.getByRole('button', { name: 'Unpin Service Catalogs', exact: true })).toBeVisible();

    await openHome(page);
    const pinned = page.getByTestId('home-pinned');
    await expect(pinned.getByRole('link', { name: 'Service Catalogs', exact: true })).toBeVisible();

    await pinned.getByRole('button', { name: 'Unpin Service Catalogs', exact: true }).click();
    await expect(pinned.getByRole('link', { name: 'Service Catalogs', exact: true })).toHaveCount(0);
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
    await expect(recent.getByRole('link').first()).toHaveText('Organizations');
    // The home itself is no task, so it never shows under Recent.
    await expect(recent.getByRole('link', { name: 'Home', exact: true })).toHaveCount(0);
  });

  test("an admin sets a user's start page and home tasks; the user lands there and sees them", async ({ page, context }) => {
    const oid = await ownAccountOid(context);
    const card = page.getByTestId('profile-customization');
    const startPage = card.getByLabel('Start page');
    const onHome = card.getByLabel('Data · Workers', { exact: true });

    await page.goto(`/auth/accounts/${oid}`);
    await expect(card.getByRole('heading', { name: 'Customization' })).toHaveCount(1);
    await expect(card.getByText('Tasks this user can open (63)')).toBeVisible();
    await expect(card.getByTestId('profile-can-open')).toContainText('Service Catalogs');
    await expect(startPage).toHaveValue('');

    try {
      await startPage.selectOption({ label: 'Data · Locations' });
      await onHome.check();
      await card.getByRole('button', { name: 'Save customization' }).click();
      await expect(card.getByRole('status')).toHaveText('Saved');

      // The user lands on the start page, and the home shows what the admin set, with no pin on it.
      await page.goto('/');
      await expect(page).toHaveURL(/\/data\/locations$/);
      await openHome(page);
      const adminSet = page.getByTestId('home-adminSet');
      await expect(adminSet.getByText('Set for you by your admin')).toBeVisible();
      await expect(adminSet.getByRole('link', { name: 'Workers', exact: true })).toBeVisible();
      await expect(adminSet.getByRole('button')).toHaveCount(0);
      await expect(page.getByTestId('home-other').getByRole('link', { name: 'Workers', exact: true })).toHaveCount(0);

      // What was saved is what the admin reads back.
      await page.goto(`/auth/accounts/${oid}`);
      await expect(startPage).toHaveValue('data.locations');
      await expect(onHome).toBeChecked();
    } finally {
      await page.goto(`/auth/accounts/${oid}`);
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
    await expect(page.getByPlaceholder('Filter…')).toHaveCount(1);
    await page.getByRole('tab', { name: 'By person' }).click();
    await page.getByPlaceholder('Filter…').fill('gate.alice');
    await page.getByTestId('task-holders').getByRole('button', { name: /gate\.alice/ }).click();
    await page.getByRole('link', { name: 'User profile: gate.alice' }).click();

    await expect(page).toHaveURL(/\/auth\/accounts\/[\w-]{22}$/);
    await expect(page.getByTestId('profile-customization').getByText('Tasks this user can open (63)')).toBeVisible();
  });
});
