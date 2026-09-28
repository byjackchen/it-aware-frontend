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
