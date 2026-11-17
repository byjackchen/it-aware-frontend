import { test, expect, type Page } from '@playwright/test';
import { PASSWORD } from './env';

/**
 * External tasks (lib/external/gateway.ts; backend specs/backend/api_specs_tasks.md,
 * "External tasks"): Ohla Router, Ohla Knowledge, Ohla Journey and Ohla Sidebar.
 * The hermetic stack sets no app address or key, so each gateway answers that the
 * app is not configured, and the page says so in words rather than drawing a
 * frame. The synthetic admin holds every task; ohla-drift-admin holds only
 * objects:interactions:read. The apps themselves, and a framed session through
 * one, are checked against a real build of the app outside this suite.
 */

const TASKS = [
  ['ohla-router', 'Ohla Router', 'admin/api/session'],
  ['ohla-knowledge', 'Ohla Knowledge', 'console'],
  ['ohla-journey', 'Ohla Journey', 'console'],
  ['ohla-sidebar', 'Ohla Sidebar', 'admin'],
] as const;

async function signIn(page: Page, username: string, password: string) {
  await page.goto('/auth/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^Login$/ }).click();
  await page.waitForURL(/\/home$/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

test.describe('External tasks', () => {
  for (const [code, name, read] of TASKS) {
    test(`${name} is a task of the admin, and says when the environment has it not set up`, async ({ page }) => {
      await page.goto(`/tasks/${code}`);
      await expect(page.getByTestId('external-task-state')).toHaveText(`${name} is not set up in this environment yet.`);
      await expect(page.getByTestId('external-task-frame')).toHaveCount(0);
      await expect(page.getByTestId('task-frame-name')).toHaveText(name);
    });

    test(`${name}: the pass-through refuses a change another site asks for, and forwards a read to the gateway`, async ({ page }) => {
      await page.goto('/home');
      const change = await page.request.post(`/api/external/${code}/${read}`, {
        data: { any: 'thing' },
        headers: { 'sec-fetch-site': 'cross-site' },
      });
      expect(change.status()).toBe(403);
      const answer = await page.request.get(`/api/external/${code}/${read}`);
      expect(answer.status()).toBe(503); // the gateway's own answer: the app is not configured
    });

    test(`${name}: a person without the permission gets no access at the address`, async ({ browser }) => {
      const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await context.newPage();
      await signIn(page, 'ohla-drift-admin', PASSWORD);
      await page.goto(`/tasks/${code}`);
      await expect(page).toHaveURL(/\/access-denied$/);
      await context.close();
    });
  }

  test('an app IT-Aware does not know is no external task', async ({ page }) => {
    await page.goto('/home');
    expect((await page.request.get('/api/external/ohla-unknown/console')).status()).toBe(404);
  });
});
