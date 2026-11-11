import { test, expect, type Page } from '@playwright/test';

/**
 * M0 golden suite: the pages §5.2 names that had no content check (Persona, the
 * relationship graph, search) and GET /api/version. Every value asserted comes from
 * the synthetic data: the backend's seed (ci/e2e/seed.py) and the UI world
 * (ci/e2e/world.py: gate.erin, its edge to Gate Carol's organization, the gate.*
 * tickets, stored by the world just before the specs run).
 */

async function workerOid(page: Page, stableId: string): Promise<string> {
  const resp = await page.request.get(`/api/objects/workers?stable_id=${stableId}&limit=5`);
  expect(resp.ok()).toBeTruthy();
  const body = (await resp.json()) as { items?: Array<{ oid: string; stable_id: string }> };
  const worker = (body.items ?? []).find((w) => w.stable_id === stableId);
  expect(worker, `${stableId} is in the synthetic world`).toBeTruthy();
  return worker!.oid;
}

test.describe('M0 golden: version, search, graph, persona', () => {
  test('G1 /api/version names only the build', async ({ request }) => {
    const resp = await request.get('/api/version');
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(Object.keys(body).sort()).toEqual(['built_at', 'commit']);
    // The e2e builds a `git archive` (no .git): the commit is unknown, the time is not.
    expect(body.commit).toBe('unknown');
    expect(body.built_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  test('G2 the top-bar search finds a seeded worker and opens it', async ({ page }) => {
    await page.goto('/data/workers');
    await page.getByPlaceholder('Search Data Objects...').fill('gate.erin');
    await page.getByRole('button', { name: 'gate.erin', exact: true }).click();
    await expect(page).toHaveURL(/\/data\/workers\/[A-Za-z0-9_-]{22}$/);
    await expect(page.getByText('Gate Erin').filter({ visible: true }).first()).toBeVisible();
  });

  test('G3 the relationship graph draws the seeded edge', async ({ page }) => {
    const oid = await workerOid(page, 'gate.erin');
    await page.goto(`/data/workers/${oid}`);
    // the filter lists the linked object type, and the canvas labels the edge
    await expect(page.getByRole('button', { name: 'organization' }).filter({ visible: true })).toBeVisible();
    await expect(page.locator('svg text', { hasText: 'belongs to' }).first()).toBeVisible();
  });

  test('G4 the persona page shows the seeded worker and their activity', async ({ page }) => {
    // The timeline shows the last 30 days by created_at, the time a row was stored:
    // ci/e2e/world.py stores Gate Carol's tickets minutes before the specs run.
    const oid = await workerOid(page, 'gate.carol');
    await page.goto(`/persona/${oid}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Gate Carol' })).toBeVisible();
    await expect(page.getByText('Loading timeline activities...')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText('No activities in selected window')).toHaveCount(0);
  });
});
