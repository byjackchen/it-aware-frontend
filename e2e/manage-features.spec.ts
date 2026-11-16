import { test, expect, type Page } from '@playwright/test';
import { FEATURES_BASE, MIGRATIONS_BASE } from '../lib/features/view';

/**
 * Manage Features (lib/features/view.ts) against the backend's own definitions
 * (it-aware-backend app/features/features.json): raw-by-source and csat-own-path,
 * nothing recorded yet, the CSAT flag at `surveys`. The phase is derived and has
 * no control: there is no Move and no note. The page's admin records a gate and is
 * refused the switch (a flip to `csat`) while its other gates are open. No flag is
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
    await expect(csat).toContainText('/ 5');
  });

  test('records a gate and is refused the switch with gates open', async ({ page }) => {
    await open(page, '?feature=csat-own-path');
    await expect(page.getByRole('heading', { name: 'ServiceNow CSAT on its own' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Flags' })).toContainText('surveys');
    await expect(page.getByText(/^Set by what ran here/)).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Move to' })).toHaveCount(0);
    await expect(page.getByPlaceholder('Add a note to the history')).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Checks' })).toContainText('check_csat_own_path_parity');

    await page.getByRole('combobox', { name: 'Gate' }).selectOption('freeze');
    await page.getByPlaceholder('Evidence text').fill('Golden files recorded (synthetic)');
    await page.getByRole('button', { name: 'Record', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Recorded.' })).toBeVisible();
    const gates = page.getByRole('table', { name: 'Gates' });
    await expect(gates.getByRole('row').filter({ hasText: 'freeze' })).toContainText('Passed');
    const history = page.getByRole('list', { name: 'History' });
    await expect(history).toContainText('Gate freeze passed');
    await expect(history).toContainText('Golden files recorded (synthetic)');

    await page.getByRole('combobox', { name: 'Value' }).selectOption('csat');
    await expect(page.getByText('Switch with gates not passed (local-parity, production-parity), for the reason given')).toBeVisible();
    await page.getByPlaceholder('Why (required)').fill('too early');
    await page.getByRole('button', { name: 'Flip', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'gates not passed: local-parity, production-parity' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Flags' })).toContainText('surveys');
  });

  test('shows the migration runs view', async ({ page }) => {
    await page.goto(MIGRATIONS_BASE);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('task-frame').getByRole('link', { name: 'Migrations', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText(/No migration run has been kept yet\.|Started/).first()).toBeVisible();
  });
});
