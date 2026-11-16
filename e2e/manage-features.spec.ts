import { test, expect, type Page } from '@playwright/test';
import { FEATURES_BASE, MIGRATIONS_BASE } from '../lib/features/view';

/**
 * Manage Features (lib/features/view.ts) against the backend's own definitions
 * (it-aware-backend app/features/features.json): raw-by-source and csat-own-path,
 * nothing recorded yet, the CSAT flag at `surveys`. The phase is derived and has
 * no control: there is no Move and no note. Gates are judged by their check and
 * cannot be recorded by hand. The page's admin is refused the switch (a flip to
 * `csat`) while its gate is open. No flag is
 * flipped here: the backend's e2e flips it on a backend of its own
 * (tests/e2e/test_manage_features.py).
 */

async function open(page: Page, query = '') {
  await page.goto(`${FEATURES_BASE}${query}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Manage Features', exact: true })).toHaveCount(1);
}

test.describe('Manage Features', () => {
  test('lists every feature with its phase and flags', async ({ page }) => {
    await open(page);
    const table = page.getByRole('table', { name: 'Features' });
    await expect(table.getByRole('link', { name: 'Raw layer by source' })).toBeVisible();
    const csat = table.getByRole('row').filter({ hasText: 'csat-own-path' });
    await expect(csat).toContainText('source = surveys');
    await expect(csat).toContainText('/ 2');
  });

  test('shows gates judged by their check and refuses the switch while one is open', async ({ page }) => {
    await open(page, '?feature=csat-own-path');
    await expect(page.getByRole('heading', { name: 'ServiceNow CSAT on its own' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Flags' })).toContainText('surveys');
    await expect(page.getByText(/^Set by what ran here/)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Move to' })).toHaveCount(0);
    await expect(page.getByPlaceholder('Add a note to the history')).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Checks' })).toContainText('check_csat_own_path_parity');

    const gates = page.getByRole('table', { name: 'Gates' });
    const gate3 = gates.getByRole('row').filter({ hasText: 'parity-7-days' });
    await expect(gate3).toContainText('Check parity passes 7 days in a row');
    await expect(gate3).toContainText('/ 7 days');
    const watch = gates.getByRole('row').filter({ hasText: 'switch-watch' });
    await expect(watch).toContainText('Check parity passes 14 days in a row after the switch');
    await expect(watch).toContainText('Not run yet'); // never switched here
    await expect(page.getByRole('button', { name: 'Record', exact: true })).toHaveCount(0);

    await page.getByRole('combobox', { name: 'Value' }).selectOption('csat');
    await expect(page.getByText('Switch with gates not passed (parity-7-days), for the reason given')).toBeVisible();
    await page.getByPlaceholder('Why (required)').fill('too early');
    await page.getByRole('button', { name: 'Flip', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'gates not passed: parity-7-days' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Flags' })).toContainText('surveys');
  });

  test('shows the migration runs view', async ({ page }) => {
    await page.goto(MIGRATIONS_BASE);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('task-frame').getByRole('link', { name: 'Migrations', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText(/No migration run has been kept yet\.|Started/).first()).toBeVisible();
  });
});
