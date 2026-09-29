import { test, expect } from '@playwright/test';

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
      month, ticket_count: 1, assessment_count: isJuly ? 1 : 0,
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

test('single-month details filter tickets with ratings and by selected score', async ({ page }) => {
  await page.route('**/api/campaigns/survey_batchs?*', (route) => route.fulfill({
    json: { items: [{ oid: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'ServiceNow Assessments', status: 'collecting', total_count: 3 }] },
  }));
  await page.route('**/api/dashboard/survey-analytics/servicenow-quality?*', (route) => route.fulfill({
    json: {
      batch_oid: 'AAAAAAAAAAAAAAAAAAAAAA',
      months: [{ month: '2026-07', ticket_count: 3, feedback_count: 2, rating_count: 3, rating_sum: 9, poor_count: 2, csat: 3, poor_rate: 66.67, feedback_rate: 66.67 }],
      averages: { csat: 3, poor_rate: 66.67, feedback_rate: 66.67 },
    },
  }));
  const assessment = (oid: string, rating: number) => ({
    oid, external_id: oid, submitted_at: '2026-07-05T12:00:00+00:00', rating,
    survey_questions: { questions: [{ question_id: 'q2', type: 'single_select', title: 'Rate service' }] },
    survey_answer: { answers: [{ question_id: 'q2', type: 'single_select', selected_option_id: String(rating) }] },
  });
  await page.route('**/api/dashboard/survey-analytics/servicenow-month-details?*', (route) => route.fulfill({ json: {
    month: '2026-07', ticket_count: 3, assessment_count: 3,
    tickets: [
      { oid: 'one', stable_id: 'INC-ONE', title: 'One', state: 'Closed', source_closed_at: '2026-07-05T12:00:00+00:00', caller_name: null, assigned_group: null, assessments: [assessment('A1', 1), assessment('A5', 5)] },
      { oid: 'three', stable_id: 'INC-THREE', title: 'Three', state: 'Closed', source_closed_at: '2026-07-05T12:00:00+00:00', caller_name: null, assigned_group: null, assessments: [assessment('A3', 3)] },
      { oid: 'none', stable_id: 'INC-NONE', title: 'None', state: 'Closed', source_closed_at: '2026-07-05T12:00:00+00:00', caller_name: null, assigned_group: null, assessments: [] },
    ],
  } }));
  await page.goto('/campaign/survey-analytics');

  await expect(page.getByText('INC-NONE')).toBeVisible();
  const filteredCount = page.getByRole('status').filter({ hasText: 'Showing' });
  await expect(filteredCount).toHaveText('Showing 3 tickets');
  await page.getByLabel('Only rated tickets').check();
  await expect(filteredCount).toHaveText('Showing 3 tickets');
  await expect(page.getByText('INC-NONE')).toBeVisible();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(filteredCount).toHaveText('Showing 2 tickets');
  await expect(page.getByText('INC-NONE')).toHaveCount(0);
  await expect(page.getByText('INC-ONE')).toBeVisible();
  await expect(page.getByText('INC-THREE')).toBeVisible();

  await expect(page.getByRole('checkbox', { name: '5', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Rating', exact: true }).click();
  await page.getByRole('checkbox', { name: '5', exact: true }).check();
  await expect(filteredCount).toHaveText('Showing 2 tickets');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(filteredCount).toHaveText('Showing 1 ticket');
  await expect(page.getByText('INC-ONE')).toBeVisible();
  await expect(page.getByText('INC-THREE')).toHaveCount(0);
  await page.getByRole('button', { name: 'Rating', exact: true }).click();
  await page.getByRole('checkbox', { name: '5', exact: true }).uncheck();
  for (const rating of ['1', '2', '3']) {
    await page.getByRole('checkbox', { name: rating, exact: true }).check();
  }
  await expect(page.getByRole('button', { name: 'Rating', exact: true })).toContainText('1, 2, 3');
  await expect(page.getByText('INC-ONE')).toBeVisible();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(filteredCount).toHaveText('Showing 2 tickets');
  await expect(page.getByText('INC-ONE')).toBeVisible();
  await expect(page.getByText('INC-THREE')).toBeVisible();
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
