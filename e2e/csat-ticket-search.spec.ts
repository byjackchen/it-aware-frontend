import { test, expect } from '@playwright/test';
import { readFile, utils as xlsxUtils } from 'xlsx';

test('ticket ID search resets paging, exports all matching pages, and clears', async ({ page, context }) => {
  await context.addCookies([{ name: 'IT_AWARE_LOCALE', value: 'en', domain: 'localhost', path: '/' }]);
  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00Z'));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: {
    account: { oid: 'test', username: 'test', is_active: true, account_type: 'user' },
    permissions: { unconstrained: ['objects:incidents:read', 'objects:survey_batchs:read'], self_scoped: [], role_based: [] },
    groups: [],
  } }));
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({ json: {
    items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 102 }],
  } }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => route.fulfill({ json: {
    batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA',
    months: [{ month: '2026-07', ticket_count: 102, poor_ticket_count: 102, feedback_ticket_count: 102,
      feedback_count: 102, rating_count: 102, rating_sum: 510, poor_count: 0, csat: 5, poor_rate: 0, feedback_rate: 100 }],
    averages: { csat: 5, poor_rate: 0, feedback_rate: 100 },
  } }));
  const tickets = Array.from({ length: 102 }, (_, index) => ({
    oid: `ticket-${index}`, stable_id: `INC-${index < 51 ? 'MATCH' : 'OTHER'}-${index + 1}`,
    title: 'Ticket', state: 'Closed', source_opened_at: '2026-07-01T00:00:00Z',
    source_closed_at: '2026-07-02T00:00:00Z', caller_name: null, assigned_group: 'OIT SSC',
    assessments: [{ oid: `rating-${index}`, external_id: null, submitted_at: '2026-07-03T00:00:00Z',
      source_taken_on: null, rating: 5, survey_questions: {}, survey_answer: {} }],
  }));
  const queries: URLSearchParams[] = [];
  let failNextSearch = false;
  await page.route('**/api/dashboard/survey-analytics/servicenow-month-details?*', (route) => {
    const query = new URL(route.request().url()).searchParams;
    queries.push(query);
    if (failNextSearch) {
      failNextSearch = false;
      return route.fulfill({ status: 503, json: { error: 'Temporary failure' } });
    }
    const matches = tickets.filter((ticket) => ticket.stable_id.toLowerCase().includes((query.get('ticket_id') ?? '').toLowerCase()));
    const pageNumber = Number(query.get('page') ?? 1);
    return route.fulfill({ json: { month: '2026-07', ticket_count: 102, assessment_count: 102,
      filtered_ticket_count: matches.length, tickets: matches.slice((pageNumber - 1) * 50, pageNumber * 50) } });
  });

  await page.goto('/itopsdashboard/survey-analytics');
  await page.getByRole('combobox', { name: /^View metric range/ }).selectOption('csat');
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText('Showing 102 ratings');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'INC-OTHER-52', exact: true })).toBeVisible();

  const search = page.getByRole('searchbox', { name: 'Ticket ID', exact: true });
  await search.fill('  inc-match  ');
  await search.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText('Showing 51 ratings');
  await expect(page.getByRole('cell', { name: 'INC-MATCH-1', exact: true })).toBeVisible();
  expect(queries.at(-1)?.get('page')).toBe('1');
  expect(queries.at(-1)?.get('ticket_id')).toBe('inc-match');
  expect(queries.at(-1)?.get('month')).toBe('2026-07');
  expect(queries.at(-1)?.get('scope')).toBe('csat');

  // Unsubmitted edits must not change the exported cohort.
  await search.fill('INC-OTHER');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel', exact: true }).last().click();
  const workbook = readFile((await (await downloadPromise).path())!);
  const rows = xlsxUtils.sheet_to_json<(string | number)[]>(workbook.Sheets['ServiceNow tickets'], { header: 1 });
  expect(rows).toHaveLength(52);
  expect(rows[1]).toContain('INC-MATCH-1');
  expect(rows.at(-1)).toContain('INC-MATCH-51');
  expect(queries.at(-1)?.get('ticket_id')).toBe('inc-match');
  expect(queries.at(-1)?.get('page')).toBe('2');

  await search.fill('inc-match-51');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText('Showing 1 rating');
  await expect(page.getByRole('cell', { name: 'INC-MATCH-51', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'INC-MATCH-1', exact: true })).toHaveCount(0);

  await search.fill('missing');
  await search.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText('Showing 0 ratings');
  await expect(page.getByRole('cell', { name: 'INC-MATCH-51', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear search', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText('Showing 102 ratings');
  expect(queries.at(-1)?.has('ticket_id')).toBe(false);

  failNextSearch = true;
  await search.fill('INC-MATCH-51');
  await search.press('Enter');
  await expect(page.getByRole('alert').filter({ hasText: 'Failed to load month details' })).toBeVisible();
  await search.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText('Showing 1 rating');
  await expect(page.getByRole('cell', { name: 'INC-MATCH-51', exact: true })).toBeVisible();
});
