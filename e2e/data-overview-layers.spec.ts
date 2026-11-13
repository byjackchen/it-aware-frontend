import { test, expect, type Page } from '@playwright/test';
import { PASSWORD } from './env';
import { TASKS } from '../lib/tasks/catalog';

/**
 * Data Overview by layer (feat/data-overview-layers): the record tiles, then
 * IT-Aware's tables under the three layers of the target data model, read from
 * the backend's GET /data/layers (specs/backend/api_specs_data_layers.md). The
 * specs act as the synthetic admin, who holds every task; ohla-drift-admin
 * holds only objects:interactions:read, so not this task.
 */

const ADDRESS = '/tasks/data-overview';
const INCIDENTS = TASKS.find((task) => task.code === 'it-incidents')!;

/** Open the page and wait until it is there once (a streamed page is briefly there twice), with its requests done. */
async function open(page: Page) {
  await page.goto(ADDRESS);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1, name: 'Data Overview', exact: true })).toHaveCount(1);
  await expect(page.getByTestId('data-layers')).toHaveCount(1);
}

test.describe('Data Overview by layer', () => {
  test('a holder sees the record tiles and the three layers in flow order, with their tables', async ({ page }) => {
    await open(page);
    await expect(page.getByText("IT-Aware's data by layer: raw → derived → transactional")).toBeVisible();

    // The record counts stay, as a row of tiles over the layers; a tile links to its object's page.
    const tiles = page.getByTestId('object-tiles');
    await expect(tiles.getByRole('listitem')).toHaveCount(11);
    await expect(tiles.getByTestId('object-tile-workers').getByRole('link')).toHaveAttribute('href', '/tasks/workers/workers');
    await expect(tiles.getByTestId('object-tile-workers')).toContainText(/Workers\s*[\d,]+/);

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
      // Its total is the tables listed under it, each with a count.
      const rows = layer.getByTestId('layer-table');
      const total = Number(await layer.getByTestId('layer-tables').innerText());
      expect(total).toBeGreaterThanOrEqual(1);
      await expect(rows).toHaveCount(total);
      for (const count of await layer.getByTestId('layer-table-rows').allInnerTexts()) {
        expect(count).toMatch(/^(≈?\d{1,3}(,\d{3})*|—)$/);
      }
    }

    // Raw: the older landing area and the raw records, each under its subject, tagged.
    const raw = layers.getByTestId('data-layer-raw');
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

  test('a person without the permission gets no access at the address', async ({ browser }) => {
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
    await expect(page.getByRole('link', { name: 'Data Overview Dashboard', exact: true })).toHaveCount(0);

    await page.goto(ADDRESS);
    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await context.close();
  });
});
