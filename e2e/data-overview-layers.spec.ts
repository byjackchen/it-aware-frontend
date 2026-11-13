import { test, expect, request, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { API_URL, PASSWORD } from './env';
import { TASKS } from '../lib/tasks/catalog';

/**
 * Data Overview by layer (feat/data-overview-layers): IT-Aware's tables under
 * the three layers of the target data model, read from the backend's
 * GET /data/layers (specs/backend/api_specs_data_overview.md). The specs act
 * as the synthetic admin, who holds every task and is an administrator (meets
 * Maintain Access's rule), so is shown every table. ohla-drift-admin holds only
 * objects:interactions:read, so not this task. A holder who is no administrator
 * is made for its own test, through the backend's API, and removed after it.
 */

const ADDRESS = '/tasks/data-overview';
const INCIDENTS = TASKS.find((task) => task.code === 'it-incidents')!;

/** The backend's API as the signed-in admin of `context`. */
async function backend(context: BrowserContext): Promise<APIRequestContext> {
  const session = (await context.cookies()).find((cookie) => cookie.name === 'it_aware_access');
  expect(session).toBeTruthy();
  return request.newContext({ extraHTTPHeaders: { Cookie: `it_aware_access=${session!.value}` } });
}

/** Sign in as `username` in a fresh context, and wait for the landing on the home. */
async function signIn(page: Page, username: string, password: string) {
  await page.goto('/auth/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^Login$/ }).click();
  // The landing first: a navigation started before it would race the login's own.
  await page.waitForURL(/\/home$/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('home-greeting')).toHaveCount(1);
}

/** Open the page and wait until it is there once (a streamed page is briefly there twice), with its requests done. */
async function open(page: Page) {
  await page.goto(ADDRESS);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1, name: 'Data Overview', exact: true })).toHaveCount(1);
  await expect(page.getByTestId('data-layers')).toHaveCount(1);
}

test.describe('Data Overview by layer', () => {
  test('an administrator sees the three layers in flow order, with every table', async ({ page }) => {
    await open(page);
    await expect(page.getByText("IT-Aware's data by layer: raw → derived → transactional")).toBeVisible();

    // The flow, then the three layers in its order.
    const layers = page.getByTestId('data-layers');
    await expect(layers.getByTestId('data-layers-flow')).toHaveText(
      'Sources → 1 Raw → rebuilt into → 2 Derived ← read together with → 3 Transactional ← people and IT-Aware',
    );
    await expect(layers.getByRole('heading', { level: 2 })).toHaveText(['Raw data', 'Derived data', 'Transactional data']);
    await expect(layers.getByTestId('data-layers-counted')).toHaveText(/^Counted (now|\d+ minutes? ago)$/);

    for (const code of ['raw', 'derived', 'transactional']) {
      const layer = layers.getByTestId(`data-layer-${code}`);
      await expect(layer).toContainText('Written by:');
      // An administrator is shown every table: its total is the tables listed under it, each with a count.
      const rows = layer.getByTestId('layer-table');
      const total = Number(await layer.getByTestId('layer-tables').innerText());
      expect(total).toBeGreaterThanOrEqual(1);
      await expect(rows).toHaveCount(total);
      await expect(layer.getByTestId('layer-hidden')).toHaveCount(0);
      await expect(layer.getByTestId('layer-rows')).toHaveText(/^≈?\d{1,3}(,\d{3})*$/);
      for (const count of await layer.getByTestId('layer-table-rows').allInnerTexts()) {
        expect(count).toMatch(/^(≈?\d{1,3}(,\d{3})*|—)$/);
      }
    }

    // Raw: its headline is the raw records' rows, none yet; the older landing area is counted apart,
    // and listed with the raw records, each under its subject, tagged.
    const raw = layers.getByTestId('data-layer-raw');
    await expect(raw.getByTestId('layer-rows')).toHaveText(/^≈?0$/);
    await expect(raw.getByTestId('layer-landing')).toHaveText(/^Older landing area: \d{1,3}(,\d{3})* rows$/);
    await expect(raw.getByTestId('layer-note')).toHaveText(
      'Not in use yet: the raw record table is empty. Today sources land in the older landing area, which raw replaces.',
    );
    await expect(raw.getByTestId('layer-group-staging').getByRole('heading', { level: 3 })).toHaveText('Older landing area');
    await expect(raw.locator('[data-table="staging.workers"]').getByTestId('layer-tag')).toHaveText('Older landing');
    await expect(raw.getByTestId('layer-group-raw').getByRole('heading', { level: 3 })).toHaveText('Raw records');
    await expect(raw.locator('[data-table="raw.records"]').getByTestId('layer-tag')).toHaveText('Raw');

    // Derived: source copies, computed tables and the ones to split; the note counts those.
    const derived = layers.getByTestId('data-layer-derived');
    await expect(derived.getByTestId('layer-group-activities').getByRole('heading', { level: 3 })).toHaveText('Tickets and interactions');
    await expect(derived.locator('[data-table="activities.incident_slas"]').getByTestId('layer-tag')).toHaveText('Source copy');
    await expect(derived.locator('[data-table="registry.global_registry"]').getByTestId('layer-tag')).toHaveText('Computed');
    const incidents = derived.locator('[data-table="activities.incidents"]');
    await expect(incidents.getByTestId('layer-tag')).toHaveText('To split');
    const toSplit = await derived.getByTestId('layer-table').getByTestId('layer-tag').filter({ hasText: 'To split' }).count();
    expect(toSplit).toBeGreaterThanOrEqual(1);
    await expect(derived.getByTestId('layer-note')).toHaveText(
      `${toSplit} tables are marked To split: they hold what the source said together with marks people added. The marks move to Transactional.`,
    );

    // Transactional: no tag; the marks of the same tables are still to arrive.
    const transactional = layers.getByTestId('data-layer-transactional');
    await expect(transactional.getByTestId('layer-group-auth').getByRole('heading', { level: 3 })).toHaveText('Accounts and access');
    await expect(transactional.getByTestId('layer-table').getByTestId('layer-tag')).toHaveCount(0);
    await expect(transactional.getByTestId('layer-note')).toHaveText(
      `Still to arrive here: the marks people add to synced records, from the ${toSplit} tables marked To split.`,
    );

    // A table whose task the person holds links to it.
    const link = incidents.getByRole('link', { name: `→ ${INCIDENTS.name.en}`, exact: true });
    await expect(link).toHaveAttribute('href', INCIDENTS.address);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${INCIDENTS.address}$`));
    await expect(page.getByTestId('task-frame').getByTestId('task-frame-name')).toHaveText(INCIDENTS.name.en);
  });

  test('a holder who is no administrator sees the totals whole, without the tables kept for administrators', async ({ browser, context }) => {
    // A holder of the page and nothing else: a group with ui:navigation:data only (backend
    // fd38d82: the auth, systems, raw and staging tables are listed for administrators only).
    const api = await backend(context);
    const username = 'gate-layers-reader';
    const password = 'gate-layers-fake-password';
    const ok = async (answer: Awaited<ReturnType<APIRequestContext['get']>>) => {
      expect(answer.ok(), `${answer.url()} answered ${answer.status()}`).toBeTruthy();
      return answer.json();
    };
    const permissions: { oid: string; permission_code: string }[] = await ok(await api.get(`${API_URL}/auth/config/permissions?limit=1000`));
    const data = permissions.find((permission) => permission.permission_code === 'ui:navigation:data');
    expect(data).toBeTruthy();
    const group = await ok(await api.post(`${API_URL}/auth/config/groups`, { data: { name: 'gate-layers-readers', scope_type: 'unconstrained' } }));
    let account: { oid: string } | null = null;
    const reader = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      await ok(await api.post(`${API_URL}/auth/config/group_permissions`, { data: { group_oid: group.oid, permission_oid: data!.oid } }));
      account = await ok(await api.post(`${API_URL}/auth/config/accounts`, { data: { username, password, account_type: 'user' } }));
      await ok(await api.post(`${API_URL}/auth/config/account_groups`, { data: { account_oid: account!.oid, group_oid: group.oid } }));

      const page = await reader.newPage();
      await signIn(page, username, password);
      await open(page);
      const layers = page.getByTestId('data-layers');
      await expect(layers.getByRole('heading', { level: 2 })).toHaveText(['Raw data', 'Derived data', 'Transactional data']);

      // Raw: every table is kept for administrators; the totals and the note are still there.
      const raw = layers.getByTestId('data-layer-raw');
      const rawTables = Number(await raw.getByTestId('layer-tables').innerText());
      expect(rawTables).toBeGreaterThanOrEqual(1);
      await expect(raw.getByTestId('layer-table')).toHaveCount(0);
      await expect(raw.getByTestId('layer-hidden')).toHaveText(
        rawTables === 1 ? '1 table is shown to administrators only' : `${rawTables} tables are shown to administrators only`,
      );
      await expect(raw.getByTestId('layer-rows')).toHaveText(/^≈?0$/);
      await expect(raw.getByTestId('layer-landing')).toHaveText(/^Older landing area: \d{1,3}(,\d{3})* rows$/);
      await expect(raw.getByTestId('layer-note')).toContainText('Not in use yet');

      // Derived: nothing is kept from them.
      const derived = layers.getByTestId('data-layer-derived');
      await expect(derived.getByTestId('layer-table')).toHaveCount(Number(await derived.getByTestId('layer-tables').innerText()));
      await expect(derived.getByTestId('layer-hidden')).toHaveCount(0);

      // Transactional: no accounts and no platform records; the line says how many are kept, and the rest are listed.
      const transactional = layers.getByTestId('data-layer-transactional');
      await expect(transactional.getByTestId('layer-group-auth')).toHaveCount(0);
      await expect(transactional.getByTestId('layer-group-systems')).toHaveCount(0);
      const total = Number(await transactional.getByTestId('layer-tables').innerText());
      const listed = await transactional.getByTestId('layer-table').count();
      expect(listed).toBeGreaterThanOrEqual(1);
      expect(listed).toBeLessThan(total);
      await expect(transactional.getByTestId('layer-hidden')).toHaveText(`${total - listed} tables are shown to administrators only`);
    } finally {
      await reader.close();
      if (account) await api.delete(`${API_URL}/auth/config/accounts/${account.oid}`);
      await api.delete(`${API_URL}/auth/config/groups/${group.oid}`);
      await api.dispose();
    }
  });

  test('a person without the permission gets no access at the address', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await signIn(page, 'ohla-drift-admin', PASSWORD);
    await expect(page.getByRole('link', { name: 'Data Overview Dashboard', exact: true })).toHaveCount(0);

    await page.goto(ADDRESS);
    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await context.close();
  });
});
