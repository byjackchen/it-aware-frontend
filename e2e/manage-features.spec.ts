import { test, expect, type Page } from '@playwright/test';
import { FEATURES_BASE } from '../lib/features/view';

/**
 * Manage Features (lib/features/view.ts) only controls feature flags, against the
 * backend's own definitions (it-aware-backend app/features/features.json). None is
 * declared since CSAT's removal (2026-11-16, ohla-xray TODO00000156): the page
 * opens with an empty list and says so, with no error. How a flag is shown and
 * flipped is held by the unit tests (lib/features).
 */

async function open(page: Page, errors: string[]) {
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(FEATURES_BASE);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Manage Features', exact: true })).toHaveCount(1);
}

test.describe('Manage Features', () => {
  test('opens cleanly when no feature has a flag', async ({ page }) => {
    const errors: string[] = [];
    await open(page, errors);
    await expect(page.getByTestId('features-empty')).toHaveText('No feature has a flag now.');
    await expect(page.getByRole('table', { name: 'Features' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
