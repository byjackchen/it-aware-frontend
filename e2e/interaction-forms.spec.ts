import { test, expect, type Page } from '@playwright/test';

/**
 * Software request forms in IT Interactions (ohla-xray TODO00000174): who used
 * which form when, down to the submitted values. The data is ci/e2e/world.py's
 * two synthetic requests: Gate Tool submitted over three turns, and one cancelled.
 */

function onScreen(page: Page, testId: string) {
  return page.getByTestId(testId).filter({ visible: true });
}

test('the form filter shows one row per request, with its badge', async ({ page }) => {
  await page.goto('/tasks/it-interactions');
  await onScreen(page, 'interactions-form-filter').selectOption('requests');
  const badges = onScreen(page, 'interaction-form-badge');
  await expect(badges).toHaveCount(2);
  await expect(badges.filter({ hasText: 'Gate Tool · Submitted · RITM9500001' })).toHaveCount(1);
  await expect(badges.filter({ hasText: 'Gate Tool · Cancelled' })).toHaveCount(1);

  await onScreen(page, 'interactions-form-filter').selectOption('turns');
  await expect(onScreen(page, 'interaction-form-badge')).toHaveCount(4);
});

test('a submitted request shows its submitted values and every turn', async ({ page }) => {
  await page.goto('/tasks/it-interactions');
  await onScreen(page, 'interactions-form-filter').selectOption('requests');
  await page.getByRole('button', { name: /Gate Tool · Submitted/ }).click();
  await page.waitForURL(/\/tasks\/it-interactions\/[^/]+$/);

  const section = onScreen(page, 'interaction-form-section');
  await expect(section.getByTestId('interaction-form-item')).toHaveText('Gate Tool');
  await expect(section.getByTestId('interaction-form-event')).toHaveText('Submitted (final)');
  const values = section.getByTestId('interaction-form-values');
  await expect(values.getByRole('row', { name: /Request Type Request Access 1/ })).toBeVisible();
  await expect(values.getByRole('row', { name: /Business Justification gate sprint work/ })).toBeVisible();

  const turns = section.getByTestId('interaction-form-turns').getByRole('listitem');
  await expect(turns).toHaveCount(3);
  await expect(turns.nth(0)).toContainText('Started');
  await expect(turns.nth(1)).toContainText('Form sent');
  await expect(turns.nth(2)).toContainText('Submitted (this turn)');

  await section.getByRole('link', { name: 'Started' }).click();
  await expect(onScreen(page, 'interaction-form-event')).toHaveText('Started');
});
