import { test, expect } from '@playwright/test';

test('SSC lists and totals follow a timezone switch while an older request is pending', async ({ page, context }) => {
  await page.setViewportSize({ width: 2048, height: 1000 });
  await context.addCookies([{ name: 'it_aware_user_data', value: Buffer.from(JSON.stringify({ preferences: { timezone: 'UTC' } })).toString('base64'), domain: 'localhost', path: '/' }]);
  const seen: string[] = [];
  for (const resource of ['interactions', 'incidents']) {
    await page.route(`**/api/objects/${resource}?*`, async (route) => {
      const params = new URL(route.request().url()).searchParams;
      const from = params.get(resource === 'interactions' ? 'created_at_from' : 'effective_at_from') ?? '';
      seen.push(`${resource}:${from}`);
      if (from.includes('+00:00')) await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({ json: { items: [], total: from.includes('-07:00') ? 2 : 1 } });
    });
  }
  await page.goto('/ssc-cockpit/dashboard');
  const profile = page.locator('div.relative.group').filter({ hasText: 'Times shown in' }).last();
  await profile.hover();
  await profile.getByRole('button', { name: /UTC UTC\+0/ }).click();
  await profile.getByRole('button', { name: /Los Angeles/ }).click();
  await expect(page.getByText('2 records')).toHaveCount(2);
  expect(seen.some((value) => value.startsWith('interactions:') && value.includes('-07:00'))).toBe(true);
  expect(seen.some((value) => value.startsWith('incidents:') && value.includes('-07:00'))).toBe(true);
  await page.route('**/api/objects/*/export.xlsx?*', (route) => route.fulfill({ body: 'xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const exportButtons = page.getByRole('button', { name: /Excel/ });
  const interactionExport = page.waitForRequest('**/api/objects/interactions/export.xlsx?*');
  await exportButtons.first().click();
  expect(new URL((await interactionExport).url()).searchParams.get('timezone')).toBe('America/Los_Angeles');
  const incidentExport = page.waitForRequest('**/api/objects/incidents/export.xlsx?*');
  await exportButtons.last().click();
  expect(new URL((await incidentExport).url()).searchParams.get('timezone')).toBe('America/Los_Angeles');
});

test('SSC rejects a nonexistent local time without crashing the dashboard', async ({ page, context }) => {
  await context.addCookies([{ name: 'it_aware_user_data', value: Buffer.from(JSON.stringify({ preferences: { timezone: 'America/New_York' } })).toString('base64'), domain: 'localhost', path: '/' }]);
  await page.route('**/api/objects/interactions?*', (route) => route.fulfill({ json: { items: [], total: 1 } }));
  await page.route('**/api/objects/incidents?*', (route) => route.fulfill({ json: { items: [], total: 1 } }));
  await page.goto('/ssc-cockpit/dashboard');
  await page.locator('input[type="datetime-local"]').first().evaluate((input) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, '2026-03-08T02:30:00');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'does not exist' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SSC Dashboard' })).toBeVisible();
});

test('SSC keeps the page usable if a selected time becomes nonexistent after switching zones', async ({ page, context }) => {
  await page.setViewportSize({ width: 2048, height: 1000 });
  await context.addCookies([{ name: 'it_aware_user_data', value: Buffer.from(JSON.stringify({ preferences: { timezone: 'UTC' } })).toString('base64'), domain: 'localhost', path: '/' }]);
  await page.route('**/api/objects/interactions?*', (route) => route.fulfill({ json: { items: [], total: 0 } }));
  await page.route('**/api/objects/incidents?*', (route) => route.fulfill({ json: { items: [], total: 0 } }));
  await page.goto('/ssc-cockpit/dashboard');
  await page.locator('input[type="datetime-local"]').first().fill('2026-03-08T02:30');
  await page.locator('input[type="datetime-local"]').nth(1).fill('2026-03-08T04:00');
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  const profile = page.locator('div.relative.group').filter({ hasText: 'Times shown in' }).last();
  await profile.hover();
  await profile.getByRole('button', { name: /UTC UTC\+0/ }).click();
  await profile.getByRole('button', { name: /New York/ }).click();
  await expect(page.getByRole('heading', { name: 'SSC Dashboard' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'does not exist' })).toBeVisible();
});
