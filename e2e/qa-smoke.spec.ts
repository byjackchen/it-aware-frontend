import { test, expect } from '@playwright/test';

/**
 * Phase C smoke — replaces the manual "Phase C" browser checklist (C1-C7) for the
 * Activities-Decouple refactor. Walks each /data tab the refactor touched and
 * asserts layout sanity (not data shape).
 *
 * Auth is established once by `auth.setup.ts` (the `setup` project) and shared
 * via storageState — every test below is already logged in.
 *
 * Pre-reqs:
 *   - Backend on localhost:8007 with auth seeding completed (P0-P5).
 *   - Frontend on localhost:3007.
 *   - byjackchen exists and has admins membership.
 */

function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const items = (payload as { items?: unknown }).items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

test.describe('Phase C — activities-decouple smoke', () => {
  test('C1+C7 sidebar has Systems, no Inquiries', async ({ page }) => {
    await page.goto('/data/workers');
    await expect(page.locator('aside').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Systems/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Inquiries?/i })).toHaveCount(0);
  });

  test('C2+C3 incidents list loads and incident detail renders QA Score section', async ({ page }) => {
    const listResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/objects/incidents') && r.request().method() === 'GET',
      { timeout: 15_000 }
    );
    await page.goto('/data/incidents');
    const listResponse = await listResponsePromise;
    expect(listResponse.ok()).toBeTruthy();
    const items = extractItems(await listResponse.json());
    expect(items.length).toBeGreaterThan(0);

    const firstIncident = items[0] as { oid?: string };
    expect(typeof firstIncident.oid).toBe('string');

    await page.goto(`/data/incidents/${firstIncident.oid}`);
    await expect(page.getByText(/^QA Score$/).first()).toBeVisible({ timeout: 15_000 });
  });

  test('C4 systems list shows seeded rows', async ({ page }) => {
    const listResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/objects/systems') && r.request().method() === 'GET',
      { timeout: 15_000 }
    );
    await page.goto('/data/systems');
    const listResponse = await listResponsePromise;
    expect(listResponse.ok()).toBeTruthy();
    const items = extractItems(await listResponse.json());
    // P5 seeds 3 default systems (servicenow-ingest, airflow-scheduler, it-aware-backend).
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  test('C5 agents list shows at least one agent (Knot QA)', async ({ page }) => {
    const listResponsePromise = page.waitForResponse(
      (r) => r.url().includes('/api/objects/agents') && r.request().method() === 'GET',
      { timeout: 15_000 }
    );
    await page.goto('/data/agents');
    const listResponse = await listResponsePromise;
    expect(listResponse.ok()).toBeTruthy();
    const items = extractItems(await listResponse.json());
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  test('C6 persona page renders and never requests inquiry endpoints', async ({ page }) => {
    const workersResponse = await page.request.get('/api/objects/workers?limit=1');
    expect(workersResponse.ok()).toBeTruthy();
    const workers = extractItems(await workersResponse.json()) as Array<{ oid?: string }>;
    expect(workers.length).toBeGreaterThan(0);
    const workerOid = workers[0]?.oid;
    expect(typeof workerOid).toBe('string');

    // Architectural smoke: post-decouple, no part of the persona page should hit
    // any inquiry endpoint. Capture every fetch the page makes and assert none
    // contain the word "inquir" in the URL.
    const inquiryRequests: string[] = [];
    page.on('request', (req) => {
      if (/inquir/i.test(req.url())) inquiryRequests.push(req.url());
    });

    await page.goto(`/persona/${workerOid}`);
    // Let the timeline lazy-fetch settle.
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    await expect(page.locator('body')).toBeVisible();
    expect(inquiryRequests, 'persona page must not call any inquiry endpoint').toEqual([]);
  });
});
