import { test, expect, type Page } from '@playwright/test';
import { USERNAME } from './env';
import { JOBS_BASE as BASE } from '../lib/jobs/paths';

/**
 * Manage Jobs (at JOBS_BASE, lib/jobs/paths.ts): IT-Aware's Airflow jobs, against the backend's
 * Airflow double (it-aware-backend ci/e2e/fixtures/airflow_world.json). The
 * double keeps nothing, so an action is checked by its answer and by the row the
 * backend wrote to the action record (real Postgres), not by a re-read job state.
 *   gate_digest   active, one failed run (steps digest, try 2, and summarize, never ran)
 *   gate_locked   paused, with load errors; Airflow refuses IT-Aware any change (403)
 *   services_trigger_notification_batch   on the run policy: run now refused
 */

const RUN = 'scheduled__2026-06-01T00:00:00+00:00';

async function open(page: Page, query = '') {
  await page.goto(`${BASE}${query}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Manage Jobs', exact: true })).toHaveCount(1);
}

test.describe('Manage Jobs', () => {
  test('lists every job with its state, and filters by text and state', async ({ page }) => {
    await open(page);
    const table = page.getByTestId('jobs-table');
    const digest = table.getByTestId('job-row-gate_digest');
    await expect(digest.getByRole('link', { name: 'Gate digest' })).toBeVisible();
    await expect(digest).toContainText('Active');
    await expect(digest).toContainText('2:00:00');
    await expect(digest).toContainText('failed');
    await expect(digest).toContainText('1m 0s');
    await expect(digest).toContainText('gate');
    const locked = table.getByTestId('job-row-gate_locked');
    await expect(locked).toContainText('Paused');
    await expect(locked).toContainText('Load errors');
    await expect(locked).toContainText('No runs');
    await expect(page.getByText('3 of 3 jobs')).toBeVisible();

    await page.getByRole('searchbox', { name: 'Filter by name, description or tag' }).fill('campaign');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.getByTestId('job-row-services_trigger_notification_batch')).toBeVisible();

    await page.getByRole('searchbox', { name: 'Filter by name, description or tag' }).fill('');
    await page.getByRole('combobox', { name: 'State' }).selectOption('paused');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.getByTestId('job-row-gate_locked')).toBeVisible();
    await page.getByRole('combobox', { name: 'State' }).selectOption('failed');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    await expect(table.getByTestId('job-row-gate_digest')).toBeVisible();
  });

  test("opens a job with its runs, and a run with its steps and a step's log", async ({ page }) => {
    await open(page);
    await page.getByTestId('jobs-table').getByRole('link', { name: 'Gate digest' }).click();
    await expect(page).toHaveURL(/\?job=gate_digest$/);
    await expect(page.getByRole('heading', { name: 'Gate digest' })).toBeVisible();
    await expect(page.getByText('A synthetic job for the journeys')).toBeVisible();
    const runs = page.getByTestId('runs-table');
    await expect(runs.locator('tbody tr')).toHaveCount(1);

    // The run id holds ':' and '+': it goes through the address and back to the backend intact.
    await runs.getByRole('link', { name: RUN }).click();
    await expect(page.getByRole('heading', { name: `Run ${RUN}` })).toBeVisible();
    await expect(page.getByText('window_hours=')).toBeVisible();
    const digest = page.getByTestId('step-row-digest');
    await expect(digest).toContainText('Digest');
    await expect(digest).toContainText('failed');
    await expect(digest).toContainText('1m 0s');
    await expect(digest.getByRole('link', { name: 'Try 1' })).toBeVisible();
    const summarize = page.getByTestId('step-row-summarize');
    await expect(summarize).toContainText('upstream_failed');
    await expect(summarize).toContainText('Not run');

    await digest.getByRole('link', { name: 'Try 2' }).click();
    const log = page.getByTestId('step-log');
    await expect(log.getByRole('heading', { name: 'Log of Digest, try 2' })).toBeVisible();
    await expect(log).toContainText('digest: starting');
    // The backend masks secrets in a log before the page sees it.
    await expect(log).toContainText('api_key=***');
    await expect(log).not.toContainText('gate-fake-key');
    await expect(log).not.toContainText('only its end is shown');
    await expect(log.getByRole('button', { name: 'Load more' })).toHaveCount(0);
  });

  test('pauses a job after a confirmation naming it, and the record shows who did it', async ({ page }) => {
    await open(page, '?job=gate_digest');
    await page.getByTestId('job-actions').getByRole('button', { name: 'Pause' }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm' });
    await expect(dialog).toContainText('Pause the schedule of Gate digest?');
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByTestId('job-action-outcome')).toHaveText('Pause: recorded as Succeeded.');

    await page.getByRole('link', { name: 'Action Record' }).click();
    await expect(page).toHaveURL(/\?tab=actions$/);
    const row = page.getByTestId('action-record').locator('tbody tr').filter({ hasText: 'gate_digest' }).filter({ hasText: 'Pause' }).first();
    await expect(row).toContainText(USERNAME);
    await expect(row).toContainText('Succeeded');
  });

  test('runs a job now with its parameters, and retries a failed run', async ({ page }) => {
    await open(page, '?job=gate_digest');
    await page.getByTestId('job-actions').getByRole('button', { name: 'Run now' }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm' });
    await expect(dialog).toContainText('Start a run of Gate digest now?');
    const hours = dialog.getByRole('spinbutton', { name: 'window_hours' });
    await expect(hours).toHaveValue('2');
    await hours.fill('3');
    // Hold the server action's answer, to see the page while the run is being started.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const thePage = (url: URL) => url.pathname === BASE;
    await page.route(
      thePage,
      async (route) => {
        if (route.request().method() === 'POST') await held;
        await route.continue();
      },
    );
    await dialog.getByRole('button', { name: 'Confirm' }).click();
    // Under way: it cannot be confirmed again, dismissed, or another action asked.
    await expect(dialog.getByRole('button', { name: 'Working…' })).toBeDisabled();
    // Cancel, and the close button (labelled Cancel too).
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(2);
    await expect(dialog.getByRole('button', { name: 'Cancel' }).first()).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Cancel' }).last()).toBeDisabled();
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('job-actions').getByRole('button', { name: 'Run now' })).toBeDisabled();
    await expect(page.getByTestId('job-actions').getByRole('button', { name: 'Pause' })).toBeDisabled();
    release();
    await expect(page.getByTestId('job-action-outcome')).toHaveText('Run now: recorded as Succeeded.');
    await expect(dialog).toHaveCount(0);
    await page.unroute(thePage);
    await expect(page.getByTestId('job-actions').getByRole('button', { name: 'Run now' })).toBeEnabled();

    await open(page, `?job=gate_digest&run=${encodeURIComponent(RUN)}`);
    await page.getByTestId('run-actions').getByRole('button', { name: 'Retry failed steps' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirm' })).toContainText(`Run the failed steps of Gate digest, run ${RUN}, again?`);
    await page.getByRole('dialog', { name: 'Confirm' }).getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByTestId('job-action-outcome')).toHaveText('Retry failed steps: recorded as Succeeded.');

    await open(page, '?tab=actions&job=gate_digest');
    const record = page.getByTestId('action-record');
    await expect(record.locator('tbody tr').filter({ hasText: 'Run now' }).first()).toContainText('"window_hours":3');
    await expect(record.locator('tbody tr').filter({ hasText: 'Retry failed' }).first()).toContainText(RUN);
  });

  test('an action Airflow refuses is shown unavailable, and a job on the run policy cannot be run by hand', async ({ page }) => {
    await open(page, '?job=gate_locked');
    await page.getByTestId('job-actions').getByRole('button', { name: 'Resume' }).click();
    await expect(page.getByRole('dialog', { name: 'Confirm' })).toContainText('Resume the schedule of Gate locked?');
    await page.getByRole('dialog', { name: 'Confirm' }).getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByTestId('job-action-outcome')).toContainText('Resume is unavailable here:');
    await expect(page.getByTestId('job-action-outcome')).toContainText('unavailable here');
    await expect(page.getByTestId('job-actions').getByRole('button', { name: 'Resume' })).toBeDisabled();

    await open(page, '?tab=actions&job=gate_locked');
    await expect(page.getByTestId('action-record').locator('tbody tr').filter({ hasText: 'Resume' }).first()).toContainText('Failed');

    await open(page, '?job=services_trigger_notification_batch');
    const runNow = page.getByTestId('job-actions').getByRole('button', { name: 'Run now' });
    await expect(runNow).toBeDisabled();
    await expect(page.getByTestId('job-actions')).toContainText('Run now is not allowed for this job: sends a campaign');
  });
});
