import { test, expect } from '@playwright/test';

/**
 * The data tasks of the data stages proposal, P1 (ohla-xray TODO00000154): View IT
 * CSAT (csat.responses under csat:responses:read) and View Raw Records (a view
 * per raw source under raw:<source>:read, none for the tier-4 chat text); and
 * Data Overview naming the raw sources of a derived table. The specs act as the
 * synthetic admin, who holds every permission; the refusals of a person without
 * them are in task-redirects.spec.ts.
 */

test.describe('data tasks', () => {
  test('View IT CSAT lists the CSAT table under its own task', async ({ page }) => {
    await page.goto('/tasks/it-csat');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('task-frame-name')).toHaveText('View IT CSAT');
    await expect(page.getByTestId('csat-total')).toHaveText(/^\d[\d,]* surveys?$/);
    // A search by an incident nobody has: the address keeps it, and nothing is listed.
    await page.getByLabel('Incident number').fill('INC0000000');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/tasks\/it-csat\?incident=INC0000000$/);
    await expect(page.getByTestId('csat-total')).toHaveText('0 surveys');
    await expect(page.getByText('No survey here.')).toBeVisible();
  });

  test('View Raw Records has a view per raw source and none for the chat text', async ({ page }) => {
    await page.goto('/tasks/raw-records/servicenow-incident');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('task-frame-name')).toHaveText('View Raw Records');
    const frame = page.getByTestId('task-frame');
    for (const name of [
      'ServiceNow Incidents',
      'ServiceNow Incident Surveys',
      'ServiceNow Survey Completions',
      'IT-Aware CSAT Archive',
      'ERP Organizations',
      'ERP Offices',
    ]) {
      await expect(frame.getByRole('link', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByTestId('raw-total')).toHaveText(/^\d[\d,]* keys? in servicenow_incident$/);
    await frame.getByRole('link', { name: 'ERP Organizations', exact: true }).click();
    await expect(page).toHaveURL(/\/tasks\/raw-records\/erp-orginfo$/);
    await expect(page.getByTestId('raw-total')).toHaveText(/ in erp_orginfo$/);
    // No page for a source without a view: Next's not-found page, inside the streamed
    // layout (so the status is 200), and no records.
    await page.goto('/tasks/raw-records/oit-chatbot-cycles');
    await expect(page.getByText('This page could not be found.')).toBeVisible();
    await expect(page.getByTestId('raw-table')).toHaveCount(0);
    await expect(page.getByTestId('raw-total')).toHaveCount(0);
  });

  test('Data Overview names the raw sources CSAT is rebuilt from', async ({ page }) => {
    await page.goto('/tasks/data-overview');
    await page.waitForLoadState('networkidle');
    const csat = page.getByTestId('data-layer-derived').locator('[data-table="csat.responses"]');
    await expect(csat.getByTestId('layer-table-sources')).toHaveText(
      'From raw: servicenow_incident_assessment, servicenow_asmt_assessment_instance, itaware_campaigns_surveys',
    );
    await expect(
      page.getByTestId('data-layer-derived').locator('[data-table="activities.incidents"]').getByTestId('layer-table-sources'),
    ).toHaveCount(0);
  });
});
