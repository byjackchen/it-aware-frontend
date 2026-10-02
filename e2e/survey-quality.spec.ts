import { test, expect } from '@playwright/test';
import { readFile, utils as xlsxUtils } from 'xlsx';

// The dashboard defaults to January..current month; the mocks below are July 2026 data.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-15T12:00:00Z'));
});

test('CSAT numerator and denominator dates are independent while rate denominators stay on opened tickets', async ({ page, context }) => {
  await context.addCookies([{ name: 'IT_AWARE_LOCALE', value: 'en', domain: 'localhost', path: '/' }]);
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 100 }] },
  }));
  const qualityQueries: URLSearchParams[] = [];
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => {
    qualityQueries.push(new URL(route.request().url()).searchParams);
    return route.fulfill({ json: {
      batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA',
      months: [{ month: '2026-07', ticket_count: 200, poor_ticket_count: 100, feedback_ticket_count: 200,
        feedback_count: 20, rating_count: 20, rating_sum: 98, poor_count: 1,
        csat: 4.9, poor_rate: 1, feedback_rate: 10 }],
      averages: { csat: 4.9, poor_rate: 1, feedback_rate: 10 },
    } });
  });
  const detailQueries: URLSearchParams[] = [];
  await page.route('**/api/dashboard/survey-analytics/servicenow-month-details?*', (route) => {
    detailQueries.push(new URL(route.request().url()).searchParams);
    return route.fulfill({ json: { month: '2026-07', ticket_count: 0, assessment_count: 0, filtered_ticket_count: 0, tickets: [] } });
  });
  await page.goto('/campaign/survey-analytics');
  await page.getByRole('button', { name: 'Date settings' }).click();
  await expect(page.getByLabel('CSAT rating points month')).toHaveValue('opened');
  await expect(page.getByLabel('Valid ratings month')).toHaveValue('opened');
  await expect(page.getByLabel('CSAT rating points month').locator('option')).toHaveCount(2);
  await expect(page.getByLabel('Poor-rated tickets month')).toBeVisible();
  await expect(page.getByLabel('Poor rate ticket denominator month')).toHaveCount(0);
  await expect(page.getByLabel('Tickets with feedback month')).toBeVisible();
  await expect(page.getByLabel('Feedback rate ticket denominator month')).toHaveCount(0);
  await expect(page.getByLabel('Tickets with feedback month')).toHaveValue('opened');
  await expect.poll(() => qualityQueries.at(-1)?.get('poor_denominator_date')).toBe('opened');
  expect(qualityQueries.at(-1)?.get('feedback_numerator_date')).toBe('opened');
  expect(qualityQueries.at(-1)?.get('feedback_denominator_date')).toBe('opened');
  expect(qualityQueries.at(-1)?.get('csat_numerator_date')).toBe('opened');
  expect(qualityQueries.at(-1)?.get('csat_denominator_date')).toBe('opened');
  await page.getByLabel('CSAT rating points month').selectOption('taken_on');
  await expect.poll(() => qualityQueries.at(-1)?.get('csat_numerator_date')).toBe('taken_on');
  expect(qualityQueries.at(-1)?.get('csat_denominator_date')).toBe('opened');
  await page.getByLabel('Valid ratings month').selectOption('taken_on');
  await expect.poll(() => qualityQueries.at(-1)?.get('csat_denominator_date')).toBe('taken_on');
  await page.getByLabel('View metric range').selectOption('csat');
  await expect.poll(() => detailQueries.at(-1)?.get('denominator_date')).toBe('taken_on');
  await page.getByRole('button', { name: 'Show calculation' }).click();
  await expect(page.getByRole('cell', { name: '98 ÷ 20 = 4.90' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '1 ÷ 100 × 100% = 1.00%' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '20 ÷ 200 × 100% = 10.00%' })).toBeVisible();
});

test('month details defaults to all tickets and exports every filtered page', async ({ page, context }) => {
  await context.addCookies([{ name: 'IT_AWARE_LOCALE', value: 'en', domain: 'localhost', path: '/' }]);
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 100 }] },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => route.fulfill({
    json: { batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA', months: [{ month: '2026-07', ticket_count: 51,
      poor_ticket_count: 51, feedback_ticket_count: 51, feedback_count: 1,
      rating_count: 1, rating_sum: 5, poor_count: 0, csat: 5, poor_rate: 0, feedback_rate: 1.96 }],
      averages: { csat: 5, poor_rate: 0, feedback_rate: 1.96 } },
  }));
  const detailQueries: URLSearchParams[] = [];
  const tickets = Array.from({ length: 51 }, (_, index) => ({
    oid: `ticket-${index}`, stable_id: `INC-${index + 1}`, title: `Ticket ${index + 1}`,
    state: 'Closed', source_opened_at: '2026-07-01T10:00:00Z', source_closed_at: '2026-07-02T10:00:00Z',
    caller_name: 'User', assigned_group: 'OIT SSC', assessments: [],
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-month-details?*', (route) => {
    const query = new URL(route.request().url()).searchParams;
    detailQueries.push(query);
    const pageNumber = Number(query.get('page') || '1');
    return route.fulfill({ json: { month: '2026-07', ticket_count: 51, assessment_count: 0,
      filtered_ticket_count: 51, tickets: tickets.slice((pageNumber - 1) * 50, pageNumber * 50) } });
  });
  await page.goto('/campaign/survey-analytics');
  await expect(page.getByLabel('View metric range')).toHaveValue('all');
  await expect.poll(() => detailQueries.at(-1)?.get('denominator_date')).toBe('closed');
  await page.getByLabel('View metric range').selectOption('csat');
  await expect.poll(() => detailQueries.at(-1)?.get('scope')).toBe('csat');
  await expect.poll(() => detailQueries.at(-1)?.get('denominator_date')).toBe('opened');
  await page.getByLabel('View metric range').selectOption('all');
  await expect.poll(() => detailQueries.at(-1)?.get('scope')).toBe('all');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel' }).click();
  const download = await downloadPromise;
  const workbook = readFile((await download.path())!);
  const rows = xlsxUtils.sheet_to_json<(string | number)[]>(workbook.Sheets['ServiceNow tickets'], { header: 1 });
  expect(rows).toHaveLength(52);
  expect(rows[1]).toContain('INC-1');
  expect(rows.at(-1)).toContain('INC-51');
  expect(detailQueries.some((query) => query.get('page') === '2')).toBe(true);
});

test('switching timezone reloads CSAT month totals and matching ticket details', async ({ page, context }) => {
  await page.setViewportSize({ width: 2048, height: 1000 });
  await context.addCookies([{ name: 'it_aware_user_data', value: Buffer.from(JSON.stringify({ preferences: { timezone: 'UTC' } })).toString('base64'), domain: 'localhost', path: '/' }]);
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({ json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 1 }] } }));
  const qualityZones: string[] = [];
  const detailZones: string[] = [];
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => {
    const zone = new URL(route.request().url()).searchParams.get('timezone') ?? 'missing';
    qualityZones.push(zone);
    const ticketCount = zone === 'America/Los_Angeles' ? 0 : 1;
    return route.fulfill({ json: { batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA', months: [{ month: '2026-07', ticket_count: ticketCount, feedback_count: ticketCount, rating_count: ticketCount, rating_sum: ticketCount * 5, poor_count: 0, csat: ticketCount ? 5 : null, poor_rate: ticketCount ? 0 : null, feedback_rate: ticketCount ? 100 : null }], averages: { csat: ticketCount ? 5 : null, poor_rate: ticketCount ? 0 : null, feedback_rate: ticketCount ? 100 : null } } });
  });
  await page.route('**/api/dashboard/survey-analytics/servicenow-month-details?*', (route) => {
    const zone = new URL(route.request().url()).searchParams.get('timezone') ?? 'missing';
    detailZones.push(zone);
    const tickets = zone === 'America/Los_Angeles' ? [] : [{ oid: 'july-ticket', stable_id: 'INC-JULY', title: 'Boundary ticket', state: 'Closed', source_closed_at: '2026-07-01T02:00:00Z', caller_name: null, assigned_group: null, assessments: [] }];
    return route.fulfill({ json: { month: '2026-07', ticket_count: tickets.length, assessment_count: 0, filtered_ticket_count: tickets.length, tickets } });
  });
  await page.goto('/campaign/survey-analytics');
  await expect(page.getByText('INC-JULY')).toBeVisible();
  expect(qualityZones).toContain('UTC');
  expect(detailZones).toContain('UTC');
  const profile = page.locator('div.relative.group').filter({ hasText: 'Times shown in' }).last();
  await profile.hover();
  await profile.getByRole('button', { name: /UTC UTC\+0/ }).click();
  await profile.getByRole('button', { name: /Los Angeles/ }).click();
  await expect(page.getByText('INC-JULY')).toHaveCount(0);
  await expect(page.getByRole('columnheader', { name: 'Closed at (America/Los_Angeles)' })).toBeVisible();
  expect(qualityZones).toContain('America/Los_Angeles');
  expect(detailZones).toContain('America/Los_Angeles');
});

test('ServiceNow quality chart shows monthly metrics and month selection', async ({ page }) => {
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 100 }] },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => {
    const url = new URL(route.request().url());
    const end = url.searchParams.get('end_month') ?? '2026-07';
    const months = Array.from({ length: Number(end.slice(-2)) }, (_, index) => ({
      month: `2026-${String(index + 1).padStart(2, '0')}`,
      ticket_count: 100, feedback_count: 20, rating_count: 20,
      poor_count: 1, csat: 4.88, poor_rate: 1, feedback_rate: 20,
    }));
    return route.fulfill({ json: { batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA', months, averages: { csat: 4.88, poor_rate: 1, feedback_rate: 20 } } });
  });
  await page.goto('/campaign/survey-analytics');

  await expect(page.getByRole('heading', { name: /Service Quality Performance/ })).toBeVisible();
  await expect(page.getByText('4.88 / 5')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Jan 2026' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Jul 2026' })).toBeVisible();

  await page.getByLabel('End month').fill('2026-03');
  await expect(page.getByRole('columnheader', { name: 'Mar 2026' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Jul 2026' })).toHaveCount(0);
});

test('metric help in cards and table shows the same definition and formula', async ({ page }) => {
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 100 }] },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => route.fulfill({
    json: {
      batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA',
      months: [{ month: '2026-01', ticket_count: 100, feedback_count: 20, rating_count: 20, poor_count: 1, csat: 4.88, poor_rate: 1, feedback_rate: 20 }],
      averages: { csat: 4.88, poor_rate: 1, feedback_rate: 20 },
    },
  }));
  await page.goto('/campaign/survey-analytics');

  for (const name of ['Ticket Rating (CSAT)', 'Poor Rating Rate (1–3)', 'Feedback Rate']) {
    const help = page.getByRole('button', { name: `About ${name}` });
    await expect(help).toHaveCount(2);
    for (const placement of [0, 1]) {
      await help.nth(placement).hover();
      const tooltip = page.getByRole('tooltip');
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText('Definition');
      await expect(tooltip).toContainText('Formula');
      await expect(tooltip).toContainText('simple average');
    }
  }
});

test('single-month details load raw tickets and assessments for the selected month', async ({ page }) => {
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 100 }] },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => route.fulfill({
    json: {
      batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA',
      months: ['2026-01', '2026-07'].map((month) => ({ month, ticket_count: 1, feedback_count: 1, rating_count: 1, poor_count: 0, csat: 5, poor_rate: 0, feedback_rate: 100 })),
      averages: { csat: 5, poor_rate: 0, feedback_rate: 100 },
    },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-month-details?*', (route) => {
    const month = new URL(route.request().url()).searchParams.get('month');
    const isJuly = month === '2026-07';
    return route.fulfill({ json: {
      month, ticket_count: 1, assessment_count: isJuly ? 1 : 0, filtered_ticket_count: 1,
      tickets: [{
        oid: 'ticket', stable_id: isJuly ? 'INC-JUL' : 'INC-JAN', title: 'Raw ticket', state: 'Closed',
        source_closed_at: `${month}-05T12:00:00+00:00`, caller_name: 'Alice', assigned_group: 'IT',
        assessments: isJuly ? [{ oid: 'assessment', external_id: 'A-1', submitted_at: `${month}-05T12:00:00+00:00`, rating: 5, survey_questions: { questions: [{ title: 'Rate service' }] }, survey_answer: { answers: [{ type: 'text', text: 'Helpful' }] } }] : [],
      }],
    } });
  });
  await page.goto('/campaign/survey-analytics');

  await expect(page.getByRole('heading', { name: 'Single-month details' })).toBeVisible();
  await expect(page.getByText('INC-JUL')).toBeVisible();
  await page.getByText('View raw assessment').click();
  await expect(page.getByText(/Helpful/)).toBeVisible();
  await expect(page.getByText(/Rate service/)).toBeVisible();

  await page.getByLabel('Detail month').selectOption('2026-01');
  await expect(page.getByText('INC-JAN')).toBeVisible();
  await expect(page.getByText('INC-JUL')).toHaveCount(0);
});

test('metric details show denominator or numerator tickets and export the selected cohort', async ({ page }) => {
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 3 }] },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => route.fulfill({
    json: { batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA', months: [{ month: '2026-07', ticket_count: 2,
      poor_ticket_count: 2, feedback_ticket_count: 2, feedback_count: 1,
      rating_count: 1, rating_sum: 2, poor_count: 1, csat: 2, poor_rate: 50, feedback_rate: 50 }],
      averages: { csat: 2, poor_rate: 50, feedback_rate: 50 } },
  }));
  const assessment = { oid: 'assessment', external_id: 'A-1', submitted_at: '2026-07-05T12:00:00Z',
    source_taken_on: '2026-07-05T12:00:00Z', rating: 2, survey_questions: {}, survey_answer: {} };
  const ticket = (id: string, withAssessment = false) => ({
    oid: id, stable_id: id, title: `Ticket ${id}`, state: 'Closed',
    source_opened_at: '2026-07-01T10:00:00Z', source_closed_at: '2026-07-05T12:00:00Z',
    caller_name: null, assigned_group: 'OIT SSC', assessments: withAssessment ? [assessment] : [],
  });
  const detailQueries: URLSearchParams[] = [];
  await page.route('**/api/dashboard/survey-analytics/servicenow-month-details?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    detailQueries.push(params);
    const scope = params.get('scope');
    const numerator = params.get('part') === 'numerator';
    const tickets = scope === 'all' ? [ticket('INC-ALL')]
      : scope === 'csat' ? [ticket('INC-CSAT', true)]
        : scope === 'poor' ? numerator ? [ticket('INC-POOR', true)] : [ticket('INC-BASE-1'), ticket('INC-BASE-2')]
          : numerator ? [ticket('INC-FEEDBACK', true)] : [ticket('INC-BASE-1'), ticket('INC-BASE-2')];
    return route.fulfill({ json: { month: '2026-07', ticket_count: tickets.length,
      assessment_count: numerator || scope === 'csat' ? 1 : 0,
      filtered_ticket_count: tickets.length, tickets } });
  });
  await page.goto('/campaign/survey-analytics');
  const scope = page.getByLabel('View metric range');
  const part = page.getByRole('group', { name: 'View numerator or denominator' });
  await expect(scope).toHaveValue('all');
  await expect(part).toHaveCount(0);
  await expect(page.getByLabel('Only rated tickets')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rating', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeVisible();
  await expect(page.getByText('INC-ALL', { exact: true })).toBeVisible();

  await scope.selectOption('csat');
  await expect(part).toHaveCount(0);
  await expect(page.getByLabel('Only rated tickets')).toHaveCount(0);
  await expect(page.getByText('INC-CSAT', { exact: true })).toBeVisible();

  await scope.selectOption('poor');
  await expect(page.getByLabel('Only rated tickets')).toHaveCount(0);
  await expect(part.getByRole('button', { name: 'View denominator' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('INC-BASE-1', { exact: true })).toBeVisible();
  expect(detailQueries.at(-1)?.get('denominator_date')).toBe('opened');
  await part.getByRole('button', { name: 'View numerator' }).click();
  await expect(page.getByText('INC-POOR', { exact: true })).toBeVisible();
  await expect(page.getByText('INC-BASE-1', { exact: true })).toHaveCount(0);
  expect(detailQueries.at(-1)?.get('numerator_date')).toBe('taken_on');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain('_poor_numerator.xlsx');
  const workbook = readFile((await download.path())!);
  const rows = xlsxUtils.sheet_to_json<(string | number)[]>(workbook.Sheets['ServiceNow tickets'], { header: 1 });
  expect(rows).toHaveLength(2);
  expect(rows[1]).toContain('INC-POOR');

  await scope.selectOption('feedback');
  await expect(page.getByRole('button', { name: 'Rating', exact: true })).toHaveCount(0);
  await expect(part.getByRole('button', { name: 'View denominator' })).toHaveAttribute('aria-pressed', 'true');
  await part.getByRole('button', { name: 'View numerator' }).click();
  await expect(page.getByText('INC-FEEDBACK', { exact: true })).toBeVisible();
  expect(detailQueries.at(-1)?.get('numerator_date')).toBe('opened');
});

test('all tickets keeps rated and score filters for its list and Excel export', async ({ page }) => {
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 3 }] },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => route.fulfill({
    json: { batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA', months: [], averages: { csat: null, poor_rate: null, feedback_rate: null } },
  }));
  const assessment = (rating: number) => ({ oid: `a-${rating}`, external_id: `a-${rating}`,
    submitted_at: '2026-07-05T12:00:00Z', source_taken_on: null, rating,
    survey_questions: {}, survey_answer: {} });
  const tickets = [
    { oid: 'one', stable_id: 'INC-ONE', title: 'First', assessments: [assessment(5)] },
    { oid: 'two', stable_id: 'INC-TWO', title: 'Second', assessments: [assessment(3)] },
    { oid: 'none', stable_id: 'INC-NONE', title: 'Third', assessments: [] },
  ].map((item) => ({ ...item, state: 'Closed', source_opened_at: '2026-07-01T10:00:00Z',
    source_closed_at: '2026-07-05T12:00:00Z', caller_name: null, assigned_group: 'OIT SSC' }));
  const queries: URLSearchParams[] = [];
  await page.route('**/api/dashboard/survey-analytics/servicenow-month-details?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    const ratings = params.getAll('ratings').map(Number);
    const selected = tickets.filter((ticket) => !ratings.length && params.get('rated_only') !== 'true'
      || ticket.assessments.some((item) => ratings.length ? ratings.includes(item.rating) : item.rating != null));
    return route.fulfill({ json: { month: '2026-07', ticket_count: 3, assessment_count: 2,
      filtered_ticket_count: selected.length, tickets: selected } });
  });
  await page.goto('/campaign/survey-analytics');
  await expect(page.getByText('INC-NONE', { exact: true })).toBeVisible();
  await page.getByLabel('Only rated tickets').check();
  await expect(page.getByText('INC-NONE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('INC-NONE', { exact: true })).toHaveCount(0);
  expect(queries.at(-1)?.get('rated_only')).toBe('true');
  await page.getByRole('button', { name: 'Rating', exact: true }).click();
  await page.getByRole('checkbox', { name: '5', exact: true }).check();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('INC-TWO', { exact: true })).toHaveCount(0);
  await expect(page.getByText('INC-ONE', { exact: true })).toBeVisible();
  expect(queries.at(-1)?.getAll('ratings')).toEqual(['5']);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel' }).click();
  const workbook = readFile((await (await downloadPromise).path())!);
  const rows = xlsxUtils.sheet_to_json<(string | number)[]>(workbook.Sheets['ServiceNow tickets'], { header: 1 });
  expect(rows).toHaveLength(2);
  expect(rows[1]).toContain('INC-ONE');
});

test('Excel export follows the applied score filter across all detail pages', async ({ page }) => {
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 52 }] },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => route.fulfill({
    json: { batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA', months: [], averages: { csat: null, poor_rate: null, feedback_rate: null } },
  }));
  const queries: URLSearchParams[] = [];
  await page.route('**/api/dashboard/survey-analytics/servicenow-month-details?*', (route) => {
    const query = new URL(route.request().url()).searchParams;
    queries.push(query);
    const filtered = query.getAll('ratings').includes('5');
    const ids = filtered ? Array.from({ length: 51 }, (_, index) => index + 1)
      : Array.from({ length: 52 }, (_, index) => index + 1);
    const pageNumber = Number(query.get('page') || '1');
    const tickets = ids.slice((pageNumber - 1) * 50, pageNumber * 50).map((id) => ({
      oid: `ticket-${id}`, stable_id: `INC-${id}`, title: `Ticket ${id}`, state: 'Closed',
      source_opened_at: '2026-07-01T10:00:00Z', source_closed_at: '2026-07-02T10:00:00Z',
      caller_name: null, assigned_group: 'OIT SSC', assessments: [],
    }));
    return route.fulfill({ json: { month: '2026-07', ticket_count: 52, assessment_count: 0,
      filtered_ticket_count: ids.length, tickets } });
  });
  await page.goto('/campaign/survey-analytics');
  await page.getByRole('button', { name: 'Rating', exact: true }).click();
  await page.getByRole('checkbox', { name: '5', exact: true }).check();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText('Showing 51 tickets');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Excel' }).click();
  const workbook = readFile((await (await downloadPromise).path())!);
  const rows = xlsxUtils.sheet_to_json<(string | number)[]>(workbook.Sheets['ServiceNow tickets'], { header: 1 });
  expect(rows).toHaveLength(52);
  expect(rows[1]).toContain('INC-1');
  expect(rows.at(-1)).toContain('INC-51');
  expect(rows.flat()).not.toContain('INC-52');
  expect(queries.some((query) => query.get('page') === '2' && query.getAll('ratings').includes('5'))).toBe(true);
});

test('single-month details requests the next server page while keeping the full count', async ({ page }) => {
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 51 }] },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => route.fulfill({
    json: { batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA', months: [{ month: '2026-07', ticket_count: 51, feedback_count: 0, rating_count: 0, rating_sum: 0, poor_count: 0, csat: null, poor_rate: 0, feedback_rate: 0 }], averages: { csat: null, poor_rate: 0, feedback_rate: 0 } },
  }));
  const requestedPages: string[] = [];
  await page.route('**/api/dashboard/survey-analytics/servicenow-month-details?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const requestedPage = params.get('page') ?? 'missing';
    requestedPages.push(requestedPage);
    const tickets = (requestedPage === '2' ? [51] : Array.from({ length: 50 }, (_, index) => index + 1))
      .map((number) => ({ oid: `ticket-${number}`, stable_id: `INC-${number}`, title: 'Ticket', state: 'Closed', source_closed_at: '2026-07-05T12:00:00Z', caller_name: null, assigned_group: null,
        assessments: number === 1 ? [{ oid: 'assessment-1', external_id: 'A-1', submitted_at: '2026-07-05T12:00:00Z', rating: 5, survey_questions: { questions: [] }, survey_answer: { answers: [{ type: 'single_select', selected_option_id: '5' }] } }] : [] }));
    return route.fulfill({ json: { month: '2026-07', ticket_count: 51, assessment_count: 0, filtered_ticket_count: 51, tickets } });
  });

  await page.goto('/campaign/survey-analytics');
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText('Showing 51 tickets');
  await expect(page.getByText('INC-1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('INC-51', { exact: true })).toBeVisible();
  await expect(page.getByText('INC-1', { exact: true })).toHaveCount(0);
  expect(requestedPages).toContain('2');
});

test('hovering each chart bar shows that metric’s numerator and denominator', async ({ page }) => {
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 100 }] },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => route.fulfill({
    json: {
      batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA',
      months: [{ month: '2026-01', ticket_count: 20, feedback_count: 10, rating_count: 10, rating_sum: 49, poor_count: 1, csat: 4.9, poor_rate: 5, feedback_rate: 50 }],
      averages: { csat: 4.9, poor_rate: 5, feedback_rate: 50 },
    },
  }));
  await page.goto('/campaign/survey-analytics');
  const bars = page.locator('.recharts-bar');
  await expect(bars).toHaveCount(3);

  await bars.nth(0).locator('.recharts-rectangle').first().hover();
  await expect(page.getByRole('tooltip')).toContainText('1 ÷ 20 × 100% = 5.00%');
  await bars.nth(1).locator('.recharts-rectangle').first().hover();
  await expect(page.getByRole('tooltip')).toContainText('49 ÷ 10 = 4.90 / 5');
  await bars.nth(2).locator('.recharts-rectangle').first().hover();
  await expect(page.getByRole('tooltip')).toContainText('10 ÷ 20 × 100% = 50.00%');
});
