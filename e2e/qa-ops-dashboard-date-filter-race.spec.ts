import { test, expect } from '@playwright/test';

/**
 * Regression: editing the Opened date on the Incident Analysis dashboard
 * must not leave whole-table numbers on screen.
 *
 * A native <input type="date"> emits an onChange per edited segment, so
 * typing `01/01/2026` fires eight param sets — including `""` (which drops
 * `source_created_at_from` entirely) and the half-typed years `0002` /
 * `0020` / `0202`, each of which matches every row. Those unfiltered
 * fetches page the whole table (18 pages, ~12s) and used to resolve AFTER
 * the intended 8-page filtered fetch, overwriting the correct numbers via
 * an unguarded `setData` in `useListResource`.
 *
 * Auth comes from the shared `setup` project (storageState).
 */

const INCIDENTS_API = '/api/objects/incidents';
const DASHBOARD = '/operation-teams/ops-dashboard/incidents';

/** Reads "Filtered: X of Y incidents" -> Y, the number of rows actually fetched. */
async function fetchedRowCount(page: import('@playwright/test').Page): Promise<number> {
  const text = await page.getByText(/Filtered:\s[\d,]+\sof\s[\d,]+\sincidents/).innerText();
  const match = text.match(/of\s([\d,]+)\sincidents/);
  if (!match) throw new Error(`could not parse header: ${text}`);
  console.log(`[header] ${text.trim()}`);
  return Number(match[1].replace(/,/g, ''));
}

test('Opened-date edit does not leave whole-table numbers on screen', async ({ page }) => {
  // Two full page loads plus a deliberate 30s settle window for a possible
  // 18-page table scan.
  test.setTimeout(180_000);
  // Ground truth straight from the API, via the page's own proxy/session.
  await page.goto(DASHBOARD);

  const totals = await page.evaluate(async () => {
    const one = async (qs: string) => {
      const r = await fetch(`/api/objects/incidents?view=slim&limit=1&${qs}`, { cache: 'no-store' });
      return (await r.json()).total as number;
    };
    return {
      unfiltered: await one(''),
      sinceJan1: await one('source_created_at_from=2026-01-01T00%3A00%3A00-08%3A00'),
    };
  });
  console.log(`[ground truth] whole table = ${totals.unfiltered}, since 2026-01-01 = ${totals.sinceJan1}`);
  expect(totals.sinceJan1).toBeLessThan(totals.unfiltered); // the filter must actually narrow

  // Record every incidents request the page issues while the date is edited.
  const requests: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url(), 'http://localhost');
    if (u.pathname === INCIDENTS_API) requests.push(u.search);
  });

  await page.goto(DASHBOARD);
  await expect(page.getByText(/Filtered:/)).toBeVisible({ timeout: 60_000 });
  requests.length = 0;

  // Type the date segment-by-segment — fill() would set it in one event and
  // would not reproduce the bug.
  const openedFrom = page.locator('input[type="date"]').first();
  // Click the LEFT edge so focus lands on the month segment; a centred click
  // lands on the year and types the digits in the wrong order.
  const box = await openedFrom.boundingBox();
  if (!box) throw new Error('Opened-from date input has no bounding box');
  await page.mouse.click(box.x + 8, box.y + box.height / 2);
  await openedFrom.pressSequentially('01012026', { delay: 60 });

  // Give every in-flight fetch — including a full 18-page table scan — time
  // to land. The bug surfaced ~10s after the correct value already rendered.
  await page.waitForTimeout(30_000);

  const unfilteredFetches = requests.filter((q) => !q.includes('source_created_at_from'));
  const bogusYearFetches = requests.filter((q) => /source_created_at_from=0\d{3}-/.test(q));
  console.log(`[requests] total=${requests.length} unfiltered=${unfilteredFetches.length} bogus-year=${bogusYearFetches.length}`);

  const rendered = await fetchedRowCount(page);
  console.log(`[rendered] rows fetched = ${rendered} (expected ~${totals.sinceJan1}, whole table = ${totals.unfiltered})`);

  await expect(openedFrom).toHaveValue('2026-01-01');
  // The screen must reflect the Jan-1 filter, not the whole table.
  expect(rendered).toBeLessThan(totals.unfiltered);
  expect(rendered).toBeLessThanOrEqual(totals.sinceJan1);
});
