import { test, expect, type Page } from '@playwright/test';
import { PASSWORD } from './env';

/**
 * Ohla Router, the first external task (lib/external/ohla-router.ts; backend
 * specs/backend/api_specs_tasks.md, "External tasks"). The hermetic stack sets
 * no delegation key, so the gateway answers that Router is not configured, and
 * the page says so in words rather than drawing a frame. The synthetic admin
 * holds every task; ohla-drift-admin holds only objects:interactions:read.
 * Router itself, and a framed session through it, are checked against a real
 * Router build outside this suite.
 */

const ADDRESS = '/tasks/ohla-router';

async function signIn(page: Page, username: string, password: string) {
  await page.goto('/auth/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^Login$/ }).click();
  await page.waitForURL(/\/home$/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Ohla Router', () => {
  test('is a task of the admin, and says when the environment has no Router set up', async ({ page }) => {
    await page.goto(ADDRESS);
    await expect(page.getByTestId('ohla-router-state')).toHaveText('Ohla Router is not set up in this environment yet.');
    await expect(page.getByTestId('ohla-router-frame')).toHaveCount(0);
  });

  test('the pass-through refuses a change another site asks for, and forwards a read to the gateway', async ({ page }) => {
    await page.goto('/home');
    const change = await page.request.post('/api/external/ohla-router/admin/api/users', {
      data: { login: 'mallory', role: 'admin' },
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(change.status()).toBe(403);
    const read = await page.request.get('/api/external/ohla-router/admin/api/session');
    expect(read.status()).toBe(503); // the gateway's own answer: no Router configured
  });

  test('a person without the permission gets no access at the address', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await signIn(page, 'ohla-drift-admin', PASSWORD);
    await page.goto(ADDRESS);
    await expect(page).toHaveURL(/\/access-denied$/);
    await context.close();
  });
});
