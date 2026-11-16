import { test, expect, type Page } from '@playwright/test';
import { FEATURES_BASE } from '../lib/features/view';

/**
 * Manage Features (lib/features/view.ts) only controls feature flags, against the
 * backend's own definitions (it-aware-backend app/features/features.json): the CSAT
 * feature and its flag `source`, at `surveys`. There is no phase, gate, check or
 * note on the page. No flag is flipped here: the backend's e2e flips it on a
 * backend of its own (tests/e2e/test_manage_features.py); the page's admin only
 * sees the form ready.
 */

async function open(page: Page, query = '') {
  await page.goto(`${FEATURES_BASE}${query}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Manage Features', exact: true })).toHaveCount(1);
}

test.describe('Manage Features', () => {
  test('lists every feature with its flags', async ({ page }) => {
    await open(page);
    const table = page.getByRole('table', { name: 'Features' });
    await expect(table.getByRole('link', { name: 'ServiceNow CSAT on its own' })).toBeVisible();
    const csat = table.getByRole('row').filter({ hasText: 'csat-own-path' });
    await expect(csat).toContainText('source = surveys');
    await expect(table.getByRole('columnheader')).toHaveText(['Feature', 'Flags', 'Last flip']);
  });

  test('shows one feature: its flags and the flip form, and nothing else', async ({ page }) => {
    await open(page, '?feature=csat-own-path');
    await expect(page.getByRole('heading', { name: 'ServiceNow CSAT on its own' })).toBeVisible();
    const flags = page.getByRole('table', { name: 'Flags' });
    await expect(flags).toContainText('surveys');
    await expect(flags).toContainText('surveys · csat');
    await expect(page.getByRole('heading', { name: 'Flips' })).toBeVisible();
    for (const gone of ['Phase', 'Gates', 'History']) {
      await expect(page.getByRole('heading', { name: gone, exact: true })).toHaveCount(0);
    }

    const value = page.getByRole('combobox', { name: 'Value' });
    await expect(value).toHaveValue('csat'); // the form starts on another value
    const flip = page.getByRole('button', { name: 'Flip', exact: true });
    await expect(flip).toBeDisabled(); // a flip needs a reason
    await page.getByPlaceholder('Why (required)').fill('ready');
    await expect(flip).toBeEnabled();
    await value.selectOption('surveys');
    await expect(flip).toBeDisabled(); // the value it already has
  });
});
