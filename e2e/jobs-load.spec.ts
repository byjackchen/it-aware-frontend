import { test, expect, type Page } from '@playwright/test';
import { PASSWORD } from './env';
import { loadHref } from '../lib/jobs/load';
import { jobsHref } from '../lib/jobs/paths';

/**
 * Manage Jobs, Load (feat/jobs-load): how much the jobs ran and how long they
 * took (backend GET /jobs/load, specs/backend/api_specs_jobs.md), against the
 * backend's Airflow double. The double dates its `load_runs` from today
 * (it-aware-backend ci/e2e/fixtures/airflow_world.json), so every window holds
 * the same four runs:
 *   gate_digest   running today; yesterday in the 03:00 hour a success (2m) and a failure (30s)
 *   gate_locked   a success two days ago at 15:00 (10m), the longest run
 * and one 200 days ago, outside every window. The specs act as the synthetic
 * admin; ohla-drift-admin holds only objects:interactions:read, so not this view.
 */

const BASE = loadHref();

/** Open the view and wait until it is there once, with its requests done. */
async function open(page: Page, query = '') {
  await page.goto(`${BASE}${query}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1, name: 'Load', exact: true })).toHaveCount(1);
}

/** The days from the first to the last of the window the page says it shows. */
async function windowDays(page: Page): Promise<number> {
  const text = await page.getByTestId('load-window').innerText();
  expect(text).toMatch(/^\d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2} \(UTC days\)$/);
  const [start, end] = text.match(/\d{4}-\d{2}-\d{2}/g)!.map((day) => Date.parse(`${day}T00:00:00Z`));
  return (end - start) / 86_400_000 + 1;
}

test.describe('Manage Jobs, Load', () => {
  test('a holder opens Load from the task and sees the tiles and the charts', async ({ page }) => {
    await page.goto(jobsHref());
    await page.waitForLoadState('networkidle');
    const views = page.getByTestId('task-frame').getByRole('navigation', { name: 'Views of Manage Jobs' });
    await expect(views.getByRole('link')).toHaveText(['Jobs', 'Load']);
    // The Jobs view's own tabs are named apart from the task's.
    await expect(page.getByRole('navigation', { name: 'Manage Jobs', exact: true }).getByRole('link')).toHaveText(['Job list', 'Action Record']);
    await views.getByRole('link', { name: 'Load' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}$`));
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { level: 1, name: 'Load', exact: true })).toHaveCount(1);
    await expect(views.getByRole('link', { name: 'Load' })).toHaveAttribute('aria-current', 'page');
    // The backend keeps the load for five minutes: the page says how fresh it is.
    await expect(page.getByText('Updated every 5 minutes.')).toBeVisible();

    // The tiles: four runs, one failed, 12m 30s in all; the longest names its job and links to it.
    await expect(page.getByTestId('load-stat-runs')).toContainText('Runs');
    await expect(page.getByTestId('load-stat-runs').locator('p').nth(1)).toHaveText('4');
    await expect(page.getByTestId('load-stat-failed').locator('p').nth(1)).toHaveText('1');
    await expect(page.getByTestId('load-stat-failed')).toContainText('25.0% of runs');
    await expect(page.getByTestId('load-stat-runTime').locator('p').nth(1)).toHaveText('12m 30s');
    await expect(page.getByTestId('load-stat-average').locator('p').nth(1)).toHaveText('4m 10s');
    const longest = page.getByTestId('load-stat-longest');
    await expect(longest.locator('p').nth(1)).toHaveText('10m 0s');
    await expect(longest.getByRole('link', { name: 'gate_locked' })).toHaveAttribute('href', jobsHref({ job: 'gate_locked' }));
    await expect(page.getByTestId('load-partial')).toHaveCount(0);
    await expect(page.getByTestId('load-empty')).toHaveCount(0);
    await expect(page.getByText('Airflow is unreachable')).toHaveCount(0);

    // Runs per day: three stacked series over the window's seven days.
    const runs = page.getByTestId('load-chart-runs');
    await expect(runs.getByText('Runs per day')).toBeVisible();
    await expect(runs.locator('.recharts-bar')).toHaveCount(3);
    await expect(runs.locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-label')).toHaveCount(7);
    await expect(runs.locator('.recharts-legend-item')).toHaveText(['Failed', 'Other', 'Succeeded']);

    // Run time per day, in minutes: the longest day took ten.
    const time = page.getByTestId('load-chart-time');
    await expect(time.getByText('Run time per day')).toBeVisible();
    await expect(time.getByText('Total run time per UTC day, in minutes')).toBeVisible();
    await expect(time.locator('.recharts-bar')).toHaveCount(1);
    await expect(time.locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-label')).toHaveCount(7);

    // By hour of the day: 24 hours, labelled UTC; the tooltip gives the time and the runs.
    const hours = page.getByTestId('load-chart-hours');
    await expect(hours.getByText('Load by hour of day (UTC)')).toBeVisible();
    await expect(hours.locator('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-label')).toHaveCount(24);
    await hours.locator('.recharts-bar-rectangle').first().hover();
    await expect(hours.locator('.recharts-tooltip-wrapper')).toContainText('2m 30s · 2 runs');

    // Jobs by time consumed: the job that took the most first.
    const jobs = page.getByTestId('load-chart-jobs');
    await expect(jobs.getByText('Jobs by time consumed')).toBeVisible();
    await expect(jobs.locator('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-label')).toHaveText(['gate_locked', 'gate_digest']);
  });

  test('the day selector changes the address and the window', async ({ page }) => {
    await open(page);
    const windows = page.getByRole('navigation', { name: 'Window' });
    await expect(windows.getByRole('link')).toHaveText(['7 days', '30 days', '90 days']);
    await expect(windows.getByRole('link', { name: '7 days' })).toHaveAttribute('aria-current', 'page');
    expect(await windowDays(page)).toBe(7);

    await windows.getByRole('link', { name: '30 days' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}\\?days=30$`));
    await expect(windows.getByRole('link', { name: '30 days' })).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => windowDays(page)).toBe(30);
    // The same four runs, in a window of thirty days.
    await expect(page.getByTestId('load-stat-runs').locator('p').nth(1)).toHaveText('4');

    await windows.getByRole('link', { name: '90 days' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}\\?days=90$`));
    await expect.poll(() => windowDays(page)).toBe(90);

    // The default window is left out of the address; one the backend would refuse is the default.
    await windows.getByRole('link', { name: '7 days' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}$`));
    await expect.poll(() => windowDays(page)).toBe(7);
    await open(page, '?days=14');
    await expect(windows.getByRole('link', { name: '7 days' })).toHaveAttribute('aria-current', 'page');
    expect(await windowDays(page)).toBe(7);
  });

  test('the table lists every job of the window, sortable, each linking to its page', async ({ page }) => {
    await open(page);
    const table = page.getByTestId('load-jobs-table');
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(2);

    // The default order: the most run time first.
    await expect(table.getByRole('columnheader', { name: 'Total' })).toHaveAttribute('aria-sort', 'descending');
    await expect(rows.first()).toHaveAttribute('data-testid', 'load-job-row-gate_locked');
    const digest = table.getByTestId('load-job-row-gate_digest');
    await expect(digest.locator('td')).toHaveText(['gate_digest', '3', '1', '2m 30s', '1m 15s', '2m 0s']);
    await expect(table.getByTestId('load-job-row-gate_locked').locator('td')).toHaveText(['gate_locked', '1', '0', '10m 0s', '10m 0s', '10m 0s']);

    // Sorted by name: A to Z, then Z to A. The table sorts once the page has
    // hydrated, which can be after goto returns: click until it has.
    const byJob = table.getByRole('columnheader', { name: 'Job' });
    await expect(async () => {
      await byJob.getByRole('button').click();
      await expect(byJob).toHaveAttribute('aria-sort', 'ascending', { timeout: 500 });
    }).toPass({ timeout: 10_000 });
    await expect(rows.first()).toHaveAttribute('data-testid', 'load-job-row-gate_digest');
    await byJob.getByRole('button').click();
    await expect(byJob).toHaveAttribute('aria-sort', 'descending');
    await expect(rows.first()).toHaveAttribute('data-testid', 'load-job-row-gate_locked');

    // By runs: the most first.
    const byRuns = table.getByRole('columnheader', { name: 'Runs' });
    await byRuns.getByRole('button').click();
    await expect(byRuns).toHaveAttribute('aria-sort', 'descending');
    await expect(byJob).toHaveAttribute('aria-sort', 'none');
    await expect(rows.first()).toHaveAttribute('data-testid', 'load-job-row-gate_digest');

    // A job's name opens the job.
    await digest.getByRole('link', { name: 'gate_digest' }).click();
    await expect(page).toHaveURL(/\?job=gate_digest$/);
    await expect(page.getByRole('heading', { name: 'Gate digest' })).toBeVisible();
  });

  test("a job's page draws the durations of its runs, a failed run apart", async ({ page }) => {
    await page.goto(jobsHref({ job: 'gate_digest' }));
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Gate digest' })).toHaveCount(1);
    // The job's one run failed after a minute: one bar, in the failed series.
    const chart = page.getByTestId('run-durations');
    await expect(chart.getByText('Run durations')).toBeVisible();
    await expect(chart.getByText('The newest run that has ended, in seconds')).toBeVisible();
    await expect(chart.locator('.recharts-legend-item')).toHaveText(['Failed run', 'Run time']);
    await expect(chart.locator('.recharts-bar-rectangle')).toHaveCount(1);

    // A job with no run has no chart.
    await page.goto(jobsHref({ job: 'gate_locked' }));
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Gate locked' })).toHaveCount(1);
    await expect(page.getByText('This job has no runs.')).toBeVisible();
    await expect(page.getByTestId('run-durations')).toHaveCount(0);
  });

  test("a person without the permission gets no access at either view's address", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/auth/login');
    await page.locator('#username').fill('ohla-drift-admin');
    await page.locator('#password').fill(PASSWORD);
    await page.getByRole('button', { name: /^Login$/ }).click();
    // The landing first: a navigation started before it would race the login's own.
    await page.waitForURL(/\/home$/, { timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('home-greeting')).toHaveCount(1);

    // Both views of the task, whatever the address asks for.
    for (const address of [BASE, `${BASE}?days=30`, `${BASE}?days=nonsense`, jobsHref(), jobsHref({ job: 'gate_digest' }), jobsHref({ tab: 'actions' })]) {
      await page.goto(address);
      await expect(page).toHaveURL(/\/access-denied$/);
      await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    }
    await context.close();
  });
});
