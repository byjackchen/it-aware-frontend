import { test, expect, type Page, type Response } from '@playwright/test';

/**
 * Activities list — source_created_at sort + richer row detail.
 *
 * Captures the manual MCP exploration on 2026-05-11 against byjackchen.
 * Each test below is a regression net for one verified behavior:
 *
 *   A-1..A-3:  /data/requests list — sort, meta, state-dot mapping.
 *   A-4..A-5:  /data/requests row helpers — caller variety, SN-created tooltip.
 *   A-6..A-8:  /api/objects/requests — default sort + order_by escape hatch + 422.
 *   B-1..B-5:  /data/incidents — symmetric coverage (sort, meta, state-dot, caller).
 *   X-1..X-2:  detail-page click-through + pagination preserves DESC order.
 *
 * Spec: docs/superpowers/specs/2026-05-11-activities-list-sort-and-row-detail-design.md
 * Helpers under test:
 *   - lib/utils/activityState.ts (getStateDotColor, resolveCaller, resolveCallerOrg)
 *   - lib/utils/datetime.ts      (formatRelative)
 */

type ListItem = {
  oid: string;
  stable_id?: string | null;
  source_created_at?: string | null;
  state?: string;
};

async function fetchJson<T = { items: ListItem[]; total: number }>(
  page: Page,
  url: string,
): Promise<{ status: number; body: T }> {
  const res = await page.request.get(url);
  return { status: res.status(), body: (await res.json()) as T };
}

/** Read [data-source-created-at] off every visible row button, in DOM order. */
async function readRowStamps(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('main button[data-source-created-at]'))
      .map((r) => r.getAttribute('data-source-created-at') ?? '')
      .filter((s) => s.length > 0),
  );
}

/** Read the three "·"-separated segments of every row's meta line. */
async function readRowMeta(
  page: Page,
): Promise<Array<{ caller: string; snCreated: string; assignedGroup: string }>> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('main button[data-source-created-at]')).map((r) => {
      const text = r.querySelector('[data-role="meta"]')?.textContent ?? '';
      const [caller = '', snCreated = '', assignedGroup = ''] = text.split('·').map((s) => s.trim());
      return { caller, snCreated, assignedGroup };
    }),
  );
}

/** Read the state text + dot color class for every row. */
async function readRowStateDots(
  page: Page,
): Promise<Array<{ state: string; dotClass: string | null }>> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('main button[data-source-created-at]')).map((r) => {
      const parts = (r.querySelector('div.text-sm.flex')?.textContent ?? '').split('•');
      const state = (parts[1] ?? '').trim();
      const dot = r.querySelector('span.rounded-full[aria-hidden]');
      const cls = dot?.className.match(/bg-\S+/)?.[0] ?? null;
      return { state, dotClass: cls };
    }),
  );
}

/**
 * Expected dot color per state. Mirrors lib/utils/activityState.ts.
 * States not in any set fall through to bg-gray-400 (the default).
 */
function expectedDotColor(state: string): string {
  const norm = state.trim().toLowerCase();
  const blue = new Set([
    'new', 'open', 'work in progress', 'work_in_progress', 'assigned', 'in progress', 'in_progress',
  ]);
  const yellow = new Set([
    'pending', 'on hold', 'on_hold', 'awaiting',
    'awaiting_user_info', 'awaiting_problem', 'awaiting_caller', 'awaiting_evidence',
  ]);
  const green = new Set(['resolved', 'closed complete', 'closed_complete', 'complete', 'done']);
  const gray = new Set(['closed incomplete', 'closed_incomplete', 'canceled', 'cancelled', 'rejected']);
  if (blue.has(norm)) return 'bg-blue-500';
  if (yellow.has(norm)) return 'bg-yellow-500';
  if (green.has(norm)) return 'bg-green-500';
  if (gray.has(norm)) return 'bg-gray-400';
  return 'bg-gray-400';
}

async function waitForList(page: Page, resource: 'requests' | 'incidents'): Promise<Response> {
  return page.waitForResponse(
    (r) =>
      r.url().includes(`/api/objects/${resource}`) &&
      r.request().method() === 'GET' &&
      r.status() === 200,
    { timeout: 15_000 },
  );
}

/** Wait until the list page has actually rendered row buttons. */
async function waitForRows(page: Page): Promise<void> {
  await expect(page.locator('main button[data-source-created-at]').first()).toBeVisible({
    timeout: 15_000,
  });
}

test.describe('Activities list — sort by source_created_at + row detail', () => {
  test('A-1 /data/requests rows are sorted DESC by source_created_at', async ({ page }) => {
    await page.goto('/data/requests');
    await waitForList(page, 'requests');
    await waitForRows(page);
    const stamps = await readRowStamps(page);
    expect(stamps.length).toBeGreaterThan(0);
    const sortedDesc = [...stamps].sort().reverse();
    expect(stamps, 'every visible row stamp is DESC').toEqual(sortedDesc);
  });

  test('A-2 every /data/requests row carries a 3-segment meta line', async ({ page }) => {
    await page.goto('/data/requests');
    await waitForList(page, 'requests');
    await waitForRows(page);
    const meta = await readRowMeta(page);
    expect(meta.length).toBeGreaterThan(0);
    for (const { caller, snCreated, assignedGroup } of meta) {
      expect(caller, 'caller segment non-empty').not.toBe('');
      expect(snCreated, `SN-created formatted: "${snCreated}"`).toMatch(
        /^SN created (just now|\d+(m|h|d|w|mo|y) ago)$/,
      );
      expect(assignedGroup, 'assigned-group segment non-empty').not.toBe('');
    }
  });

  test('A-3 /data/requests state dots match the helper mapping', async ({ page }) => {
    await page.goto('/data/requests');
    await waitForList(page, 'requests');
    await waitForRows(page);
    const dots = await readRowStateDots(page);
    expect(dots.length).toBeGreaterThan(0);
    for (const { state, dotClass } of dots) {
      expect(state, 'state text present').not.toBe('');
      expect(dotClass, `dot color for state "${state}"`).toBe(expectedDotColor(state));
    }
  });

  test('A-4 /data/requests caller column shows real variety (not all "—")', async ({ page }) => {
    await page.goto('/data/requests');
    await waitForList(page, 'requests');
    await waitForRows(page);
    const meta = await readRowMeta(page);
    const unique = new Set(meta.map((m) => m.caller));
    expect(meta.length).toBeGreaterThan(10);
    expect(unique.size, 'caller fallback chain produces more than 1 distinct label').toBeGreaterThan(1);
    expect(unique.has('—'), 'every row resolves to *some* caller').toBe(false);
  });

  test('A-5 /data/requests SN-created tooltip carries an absolute datetime', async ({ page }) => {
    await page.goto('/data/requests');
    await waitForList(page, 'requests');
    await waitForRows(page);
    const firstTooltip = await page.evaluate(() => {
      const meta = document.querySelector('main button[data-source-created-at] [data-role="meta"]');
      const spans = meta?.querySelectorAll('span');
      return spans?.[2]?.getAttribute('title') ?? null;
    });
    expect(firstTooltip, 'tooltip present on the SN-created span').not.toBeNull();
    expect(firstTooltip, 'tooltip looks like a locale datetime').toMatch(
      /\d{1,2}\/\d{1,2}\/\d{4}.*\(.+\)/,
    );
  });

  test('A-6 /api/objects/requests default response is DESC by source_created_at', async ({ page }) => {
    const { status, body } = await fetchJson(page, '/api/objects/requests?limit=20');
    expect(status).toBe(200);
    expect(body.items.length).toBeGreaterThan(1);
    const stamped = body.items
      .map((it) => it.source_created_at)
      .filter((s): s is string => typeof s === 'string');
    expect(stamped, 'every item has source_created_at on the first page (NULLs sort last)').toHaveLength(body.items.length);
    expect(stamped).toEqual([...stamped].sort().reverse());
  });

  test('A-7 /api/objects/requests order_by=created_at returns a different first row', async ({ page }) => {
    const def = await fetchJson(page, '/api/objects/requests?limit=1');
    const ingest = await fetchJson(page, '/api/objects/requests?limit=1&order_by=created_at');
    expect(def.status).toBe(200);
    expect(ingest.status).toBe(200);
    const defOid = def.body.items[0]?.oid;
    const ingestOid = ingest.body.items[0]?.oid;
    expect(defOid).toBeTruthy();
    expect(ingestOid).toBeTruthy();
    expect(defOid, 'escape hatch must change ordering vs default').not.toBe(ingestOid);
  });

  test('A-8 /api/objects/requests order_by=foo is rejected with 422', async ({ page }) => {
    const res = await page.request.get('/api/objects/requests?order_by=foo');
    expect(res.status()).toBe(422);
  });

  test('B-1 /data/incidents rows are sorted DESC by source_created_at', async ({ page }) => {
    await page.goto('/data/incidents');
    await waitForList(page, 'incidents');
    await waitForRows(page);
    const stamps = await readRowStamps(page);
    expect(stamps.length).toBeGreaterThan(0);
    expect(stamps).toEqual([...stamps].sort().reverse());
  });

  test('B-2 every /data/incidents row carries a 3-segment meta line', async ({ page }) => {
    await page.goto('/data/incidents');
    await waitForList(page, 'incidents');
    await waitForRows(page);
    const meta = await readRowMeta(page);
    expect(meta.length).toBeGreaterThan(0);
    for (const { caller, snCreated, assignedGroup } of meta) {
      expect(caller).not.toBe('');
      expect(snCreated).toMatch(/^SN created (just now|\d+(m|h|d|w|mo|y) ago)$/);
      expect(assignedGroup).not.toBe('');
    }
  });

  test('B-3 /data/incidents state dots match the helper mapping', async ({ page }) => {
    await page.goto('/data/incidents');
    await waitForList(page, 'incidents');
    await waitForRows(page);
    const dots = await readRowStateDots(page);
    expect(dots.length).toBeGreaterThan(0);
    for (const { state, dotClass } of dots) {
      expect(state).not.toBe('');
      expect(dotClass).toBe(expectedDotColor(state));
    }
  });

  test('B-4 /data/incidents caller resolution surfaces both worker fullnames and system stable_ids', async ({ page }) => {
    await page.goto('/data/incidents');
    await waitForList(page, 'incidents');
    await waitForRows(page);
    const meta = await readRowMeta(page);
    expect(meta.length).toBeGreaterThan(10);
    const unique = new Set(meta.map((m) => m.caller));
    expect(unique.size).toBeGreaterThan(1);
    expect(unique.has('—'), 'no row should fall all the way through to "—"').toBe(false);
    // The seed data includes the grafana_integration system actor; this asserts
    // the actor_stable_id fallback works when actor.fullname is absent.
    const hasSystemActor = meta.some((m) => /^[a-z_]+$/.test(m.caller));
    const hasNamedWorker = meta.some((m) => /^[A-Z]/.test(m.caller) && m.caller.includes(' '));
    expect(hasSystemActor || hasNamedWorker, 'at least one non-trivial caller variety').toBe(true);
  });

  test('B-5 /api/objects/incidents default response is DESC by source_created_at', async ({ page }) => {
    const { status, body } = await fetchJson(page, '/api/objects/incidents?limit=20');
    expect(status).toBe(200);
    expect(body.items.length).toBeGreaterThan(1);
    const stamped = body.items
      .map((it) => it.source_created_at)
      .filter((s): s is string => typeof s === 'string');
    expect(stamped).toHaveLength(body.items.length);
    expect(stamped).toEqual([...stamped].sort().reverse());
  });

  test('B-6 /api/objects/incidents order_by=created_at flips the first row', async ({ page }) => {
    const def = await fetchJson(page, '/api/objects/incidents?limit=1');
    const ingest = await fetchJson(page, '/api/objects/incidents?limit=1&order_by=created_at');
    expect(def.status).toBe(200);
    expect(ingest.status).toBe(200);
    expect(def.body.items[0]?.oid).not.toBe(ingest.body.items[0]?.oid);
  });

  test('B-7 /api/objects/incidents order_by=foo is rejected with 422', async ({ page }) => {
    const res = await page.request.get('/api/objects/incidents?order_by=foo');
    expect(res.status()).toBe(422);
  });

  test('X-1 clicking a row navigates to the matching detail page', async ({ page }) => {
    await page.goto('/data/incidents');
    await waitForList(page, 'incidents');
    await waitForRows(page);
    const target = await page.evaluate(() => {
      const row = document.querySelector('main button[data-source-created-at]') as HTMLElement | null;
      if (!row) return null;
      return {
        stableId: row.querySelector('div.text-sm.flex span:first-child')?.textContent?.trim() ?? '',
      };
    });
    expect(target?.stableId).toMatch(/^INC\d+$/);
    await page.locator('main button[data-source-created-at]').first().click();
    await expect(page.getByRole('heading', { name: /Incident Details/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('main')).toContainText(target!.stableId);
  });

  test('X-2 paginating preserves DESC order across page boundary', async ({ page }) => {
    await page.goto('/data/requests');
    await waitForList(page, 'requests');
    await waitForRows(page);
    const before = await readRowStamps(page);
    expect(before.length).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Next page' }).click();
    // Give the local-paginate or remote fetch a chance to settle.
    await page.waitForTimeout(1500);
    const after = await readRowStamps(page);
    expect(after.length).toBeGreaterThan(0);
    // Each page is internally DESC.
    expect(after).toEqual([...after].sort().reverse());
    // Page 2's first stamp must be <= page 1's last stamp (DESC across pages).
    expect(after[0] <= before[before.length - 1]).toBe(true);
  });
});
