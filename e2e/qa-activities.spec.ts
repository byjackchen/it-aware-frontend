import { test, expect, type Page, type Response } from '@playwright/test';

/**
 * Activities (incidents + requests) end-to-end smoke.
 *
 * Built from a manual MCP-driven walk on 2026-05-09 against byjackchen on the
 * activities-decouple stack (Phase 2 base-table denormalize + Phase 3 typed
 * actor). Auth comes from the shared `setup` project (storageState).
 *
 * The walk found these regressions; each test below is the regression net for
 * one of them:
 *   - B1: ABAC role-alias collision broke /objects/activities/requests
 *   - B2: missing Sidebar.incidentReport i18n key
 *   - B3: SSCIncidentReport namespace nested inside Auth → raw keys in EN
 *   - B4: missing Persona.sections.experimental{,Hint} i18n keys
 *
 * If any of those bugs comes back, the corresponding test below will fail.
 */

function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const items = (payload as { items?: unknown }).items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

/**
 * Catch i18n drift at runtime: next-intl logs `MISSING_MESSAGE: <key> (en)`
 * to console.error when a translation key is unresolved. Asserting absence is
 * cheaper than enumerating every key.
 */
function watchForMissingMessages(page: Page): { collected: string[] } {
  const collected: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/MISSING_MESSAGE/i.test(text)) collected.push(text.split('\n')[0]);
  });
  return { collected };
}

async function fetchFirstItem<T = Record<string, unknown>>(
  page: Page,
  url: string
): Promise<T | undefined> {
  const res = await page.request.get(url);
  expect(res.ok(), `${url} should return 2xx`).toBeTruthy();
  const items = extractItems(await res.json());
  return items[0] as T | undefined;
}

test.describe('Incidents — list, detail, dashboards, persona', () => {
  test('I-1 /data/incidents list loads with ≥1 row and no missing i18n', async ({ page }) => {
    const i18n = watchForMissingMessages(page);
    const listPromise = page.waitForResponse(
      (r) => r.url().includes('/api/objects/incidents') && r.request().method() === 'GET',
      { timeout: 15_000 }
    );
    await page.goto('/data/incidents');
    const list = await listPromise;
    expect(list.ok()).toBeTruthy();
    expect(extractItems(await list.json()).length).toBeGreaterThan(0);
    expect(i18n.collected, 'no MISSING_MESSAGE on incidents list').toEqual([]);
  });

  test('I-2 /data/incidents/[oid] detail renders QA Score + actor_stable_id (Phase 3)', async ({ page }) => {
    const sample = await fetchFirstItem<{
      oid: string;
      stable_id: string;
      actor_type?: string;
      actor_oid?: string;
      actor_stable_id?: string;
    }>(page, '/api/objects/incidents?limit=1');
    expect(sample?.oid).toBeTruthy();
    // Phase 3 surfacing: every legacy incident defaults to actor_type='worker'.
    expect(sample?.actor_type).toBe('worker');

    await page.goto(`/data/incidents/${sample!.oid}`);
    // QA Score section renders unconditionally (even when score is null).
    await expect(page.getByText(/^QA Score$/).first()).toBeVisible({ timeout: 15_000 });
    // The denormalized actors-section heading from Phase 2.
    await expect(page.getByText(/^Actors\b/).first()).toBeVisible();
    // Phase 3 ActorBadge: typed pill + stable_id, both rendered.
    const badge = page.getByTestId('actor-type-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/Worker|System|Agent|External/);
    const id = page.getByTestId('actor-stable-id');
    await expect(id).toBeVisible();
    if (sample?.actor_stable_id) {
      await expect(id).toHaveText(sample.actor_stable_id);
    }
    // Worker actors get a profile link; non-worker actors render as plain text.
    if (sample?.actor_type === 'worker' && sample.actor_stable_id) {
      await expect(id).toHaveAttribute('href', `/data/workers/${sample.actor_stable_id}`);
    }
  });

  test('I-3 /ssc-cockpit/dashboard loads with no MISSING_MESSAGE', async ({ page }) => {
    const i18n = watchForMissingMessages(page);
    const incidentsPromise = page.waitForResponse(
      (r) => r.url().includes('/api/objects/incidents') && r.request().method() === 'GET',
      { timeout: 15_000 }
    );
    await page.goto('/ssc-cockpit/dashboard');
    expect((await incidentsPromise).ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: /SSC Dashboard/i })).toBeVisible();
    // B2 regression net: Sidebar.incidentReport must resolve.
    expect(i18n.collected, 'no MISSING_MESSAGE on SSC dashboard').toEqual([]);
  });

  test('I-4 /ssc-cockpit/incident-report renders translated labels (no raw keys)', async ({ page }) => {
    const i18n = watchForMissingMessages(page);
    await page.goto('/ssc-cockpit/incident-report');
    // B3 regression net: page must render English labels, not raw keys like
    // "SSCIncidentReport.title" or "SSCINCIDENTREPORT.KPI.TOTALINCIDENTS".
    await expect(page.getByRole('heading', { name: /Incident Monthly Report/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/^TOTAL INCIDENTS$/i).first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/SSCIncidentReport\.[a-z]/);
    expect(i18n.collected, 'no MISSING_MESSAGE on incident-report').toEqual([]);
  });

  test('I-5 /operation-teams/ops-dashboard/incidents loads with analysis charts', async ({ page }) => {
    const slimPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/objects/incidents') &&
        r.url().includes('view=slim') &&
        r.request().method() === 'GET',
      { timeout: 15_000 }
    );
    await page.goto('/operation-teams/ops-dashboard/incidents');
    expect((await slimPromise).ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: /Incident Analysis/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Active by Priority/i })).toBeVisible();
  });

  test('I-6 /operation-teams/ops-dashboard/aging-incidents loads with active-state filter', async ({ page }) => {
    const agingPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/objects/incidents') &&
        r.url().includes('states_list=') &&
        r.request().method() === 'GET',
      { timeout: 15_000 }
    );
    await page.goto('/operation-teams/ops-dashboard/aging-incidents');
    expect((await agingPromise).ok()).toBeTruthy();
    await expect(page.getByRole('heading', { name: /Aging Incidents/i })).toBeVisible();
  });

  test('I-7 /persona/[oid] fetches incidents+requests+interactions without 500 (B1 regression net)', async ({ page }) => {
    const worker = await fetchFirstItem<{ oid: string }>(page, '/api/objects/workers?limit=1');
    expect(worker?.oid).toBeTruthy();

    const i18n = watchForMissingMessages(page);
    const failures: Array<{ url: string; status: number }> = [];
    page.on('response', (resp: Response) => {
      const url = resp.url();
      if (!/\/api\/objects\/(incidents|requests|interactions)/.test(url)) return;
      if (resp.status() >= 500) failures.push({ url, status: resp.status() });
    });

    await page.goto(`/persona/${worker!.oid}`);
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    expect(failures, 'no 5xx on persona timeline lanes').toEqual([]);
    // B4 regression net.
    expect(i18n.collected, 'no MISSING_MESSAGE on persona').toEqual([]);
  });
});

test.describe('Requests — list, detail, creation form', () => {
  test('R-1 /data/requests list loads (B1 regression net) with ≥1 row', async ({ page }) => {
    const failures: Array<{ url: string; status: number }> = [];
    page.on('response', (resp: Response) => {
      if (
        resp.url().includes('/api/objects/requests') &&
        resp.request().method() === 'GET' &&
        resp.status() >= 500
      ) {
        failures.push({ url: resp.url(), status: resp.status() });
      }
    });

    const listPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/api/objects/requests') &&
        r.request().method() === 'GET' &&
        r.status() === 200,
      { timeout: 15_000 }
    );
    await page.goto('/data/requests');
    const list = await listPromise;
    const items = extractItems(await list.json());
    expect(items.length).toBeGreaterThan(0);
    // Phase 3 typed actor: at least one of the supported actor types should appear.
    const types = new Set(
      items
        .map((it) => (it as { actor_type?: string }).actor_type)
        .filter((t): t is string => typeof t === 'string')
    );
    expect(
      [...types].some((t) => ['worker', 'agent', 'system', 'external'].includes(t)),
      'at least one request should have a typed actor_type'
    ).toBe(true);
    // No 5xx anywhere on the page (catches B1-style retry loops too).
    expect(failures, 'no 5xx from /api/objects/requests').toEqual([]);
  });

  test('R-2 /data/requests/[oid] detail renders core sections + actor badge', async ({ page }) => {
    const sample = await fetchFirstItem<{
      oid: string;
      stable_id: string;
      actor_type?: string;
      actor_stable_id?: string;
    }>(page, '/api/objects/requests?limit=1');
    expect(sample?.oid).toBeTruthy();

    await page.goto(`/data/requests/${sample!.oid}`);
    await expect(page.getByRole('heading', { name: /Request Details/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/^Actors\b/).first()).toBeVisible();
    // Phase 3 ActorBadge surfaces typed actor on the request detail too.
    const badge = page.getByTestId('actor-type-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/Worker|System|Agent|External/);
    if (sample?.actor_stable_id) {
      await expect(page.getByTestId('actor-stable-id')).toHaveText(sample.actor_stable_id);
    }
  });

  test('R-3 /data/requests/new form renders Required + Optional sections', async ({ page }) => {
    const i18n = watchForMissingMessages(page);
    await page.goto('/data/requests/new');
    await expect(page.getByRole('heading', { name: /^New Request$/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: /^Required$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Optional$/i })).toBeVisible();
    expect(i18n.collected, 'no MISSING_MESSAGE on new request form').toEqual([]);
  });
});

test.describe('Systems — list, detail, full CRUD round-trip', () => {
  test('S-1 /data/systems list loads with seeded rows + clickable to detail', async ({ page }) => {
    const listPromise = page.waitForResponse(
      (r) => r.url().includes('/api/objects/systems') && r.request().method() === 'GET',
      { timeout: 15_000 }
    );
    await page.goto('/data/systems');
    const list = await listPromise;
    expect(list.ok()).toBeTruthy();
    const items = extractItems(await list.json()) as Array<{ system_id: string }>;
    // P5 seeds 3 default systems; CRUD tests may add transient ones, so allow more.
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items.some((s) => s.system_id === 'it-aware-backend')).toBe(true);
  });

  test('S-2 /data/systems/[oid] detail page loads with edit+delete affordances', async ({ page }) => {
    const sample = await fetchFirstItem<{ oid: string; system_id: string; name: string }>(
      page,
      '/api/objects/systems?limit=1'
    );
    expect(sample?.oid).toBeTruthy();

    await page.goto(`/data/systems/${sample!.oid}`);
    await expect(page.getByTestId('system-detail-title')).toHaveText('System Details');
    await expect(page.getByTestId('system-stable-id')).toHaveText(sample!.system_id);
    await expect(page.getByTestId('system-edit-button')).toBeVisible();
    await expect(page.getByTestId('system-delete-button')).toBeVisible();
  });

  test('S-3 /data/systems/new form renders all required fields', async ({ page }) => {
    await page.goto('/data/systems/new');
    await expect(page.getByRole('heading', { name: /^New System$/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('heading', { name: /^Required$/i })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. ServiceNow Ingestion')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. servicenow-ingest')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. ingestion, scheduler, internal')).toBeVisible();
    await expect(page.getByTestId('system-create-submit')).toBeVisible();
  });

  test('S-4 full CRUD round-trip: create → edit → soft-delete', async ({ page }) => {
    // Use a unique system_id so parallel runs / re-runs don't collide.
    const stamp = Date.now();
    const systemId = `e2e-test-${stamp}`;
    const initialName = `E2E Test System ${stamp}`;
    const renamedName = `${initialName} (renamed)`;

    // CREATE
    await page.goto('/data/systems/new');
    await page.getByPlaceholder('e.g. ServiceNow Ingestion').fill(initialName);
    await page.getByPlaceholder('e.g. servicenow-ingest').fill(systemId);
    await page.getByPlaceholder('e.g. ingestion, scheduler, internal').fill('test');
    await page.getByTestId('system-create-submit').click();
    await page.waitForURL('**/data/systems', { timeout: 15_000 });

    // Verify created
    let listAfterCreate = extractItems(
      await (await page.request.get('/api/objects/systems?limit=1000')).json()
    ) as Array<{ oid: string; system_id: string; name: string; is_active: boolean }>;
    const created = listAfterCreate.find((s) => s.system_id === systemId);
    expect(created, 'system should appear after create').toBeTruthy();
    expect(created!.name).toBe(initialName);
    expect(created!.is_active).toBe(true);

    // EDIT (rename via detail page)
    await page.goto(`/data/systems/${created!.oid}`);
    await page.getByTestId('system-edit-button').click();
    // The Name input is the first editable text input on the detail card.
    await page.locator(`input[value="${initialName}"]`).fill(renamedName);
    await page.getByTestId('system-save-button').click();

    // Wait for the edit-mode buttons to disappear (handler flips isEditing back to false).
    await expect(page.getByTestId('system-edit-button')).toBeVisible({ timeout: 15_000 });

    let listAfterEdit = extractItems(
      await (await page.request.get(`/api/objects/systems?limit=1000`)).json()
    ) as Array<{ oid: string; system_id: string; name: string }>;
    const edited = listAfterEdit.find((s) => s.system_id === systemId);
    expect(edited?.name).toBe(renamedName);

    // SOFT-DELETE (backend convention: flips is_active=false; row stays in list)
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByTestId('system-delete-button').click();
    await page.waitForURL('**/data/systems', { timeout: 15_000 });

    let listAfterDelete = extractItems(
      await (await page.request.get(`/api/objects/systems?limit=1000`)).json()
    ) as Array<{ system_id: string; is_active: boolean }>;
    const softDeleted = listAfterDelete.find((s) => s.system_id === systemId);
    expect(softDeleted, 'system should still exist after soft-delete').toBeTruthy();
    expect(softDeleted!.is_active, 'is_active should flip to false').toBe(false);
  });
});
