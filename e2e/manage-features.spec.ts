import { test, expect, type Page } from '@playwright/test';
import { FEATURES_BASE, MIGRATIONS_BASE } from '../lib/features/view';

/**
 * Manage Features (lib/features/view.ts) against the backend's own definitions
 * (it-aware-backend app/features/features.json): raw-by-source and csat-own-path,
 * nothing recorded yet, the CSAT flag at `surveys`. The page's admin records a
 * gate, moves the CSAT feature to add, and is refused the switch while its gates
 * are open. No flag is flipped here: the backend's e2e flips it on a backend of
 * its own (tests/e2e/test_manage_features.py).
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

  test('records a gate, moves to add, and is refused the switch with gates open', async ({ page }) => {
    await open(page, '?feature=csat-own-path');
    await expect(page.getByRole('heading', { name: 'ServiceNow CSAT on its own' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Flags' })).toContainText('surveys');
    await expect(page.getByText('A flag is flipped only in the switch phase.')).toBeVisible();

    await page.getByRole('combobox', { name: 'Gate' }).selectOption('freeze');
    await page.getByPlaceholder('Evidence text').fill('Golden files recorded (synthetic)');
    await page.getByRole('button', { name: 'Record', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Recorded.' })).toBeVisible();
    const gates = page.getByRole('table', { name: 'Gates' });
    await expect(gates.getByRole('row').filter({ hasText: 'freeze' })).toContainText('Passed');
    const history = page.getByRole('list', { name: 'History' });
    await expect(history).toContainText('Gate freeze passed');
    await expect(history).toContainText('Golden files recorded (synthetic)');

    const target = page.getByRole('combobox', { name: 'Move to' });
    await target.selectOption('add');
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(history).toContainText('Entered Add (expand)');

    await target.selectOption('switch');
    await page.getByRole('button', { name: 'Move', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'gates not passed: local-parity, production-parity' })).toBeVisible();
  });

  test('shows the migration runs view', async ({ page }) => {
    await page.goto(MIGRATIONS_BASE);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('task-frame').getByRole('link', { name: 'Migrations', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText(/No migration run has been kept yet\.|Started/).first()).toBeVisible();
  });
});
