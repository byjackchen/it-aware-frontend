import fs from 'node:fs';
import path from 'node:path';
import { test, expect, request } from '@playwright/test';
import { pagesWithoutTask } from '../lib/tasks/pages';
import type { TaskAccess } from '../lib/types/tasks';
import { API_URL, PASSWORD } from './env';

/**
 * Tasks 1 (TODO00000140): the admin's "who has what tasks" page, and the two
 * reporting-only checks of the task catalog. The page is reached by address;
 * the menu does not change.
 */

async function taskAccess(cookie: string): Promise<TaskAccess> {
  const api = await request.newContext({ extraHTTPHeaders: { Cookie: cookie } });
  const response = await api.get(`${API_URL}/tasks/access`);
  expect(response.ok()).toBeTruthy();
  const access = (await response.json()) as TaskAccess;
  await api.dispose();
  return access;
}

function pageFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pageFiles(full);
    return entry.name === 'page.tsx' ? [full] : [];
  });
}

test.describe('Tasks 1: task access', () => {
  test('an admin sees who has what tasks, by group and by person', async ({ page }) => {
    await page.goto('/auth/tasks');
    await expect(page.getByRole('heading', { name: 'Task access' })).toBeVisible();

    // By group: gate-readers holds every read and ui permission (backend ci/e2e/seed.py).
    await page.getByPlaceholder('Filter…').fill('gate-readers');
    await page.getByTestId('task-holders').getByRole('button', { name: /gate-readers/ }).click();
    const tasks = page.getByTestId('task-list');
    await expect(tasks.getByRole('link', { name: 'Service Catalogs' })).toHaveAttribute('href', '/data/service-catalogs');
    await expect(tasks.getByText('data.service_catalogs')).toBeVisible();

    // By person: each task carries the scope it is held under.
    await page.getByRole('tab', { name: 'By person' }).click();
    await expect(tasks.getByText('Pick a group or a person')).toBeVisible();
    await page.getByPlaceholder('Filter…').fill('gate.alice');
    await page.getByTestId('task-holders').getByRole('button', { name: /gate\.alice/ }).click();
    await expect(tasks.getByRole('link', { name: 'Service Catalogs' })).toBeVisible();
    await expect(tasks.getByText('Unconstrained').first()).toBeVisible();
  });

  test('the menu does not change: the page is not in the sidebar', async ({ page }) => {
    await page.goto('/auth/tasks');
    const sidebar = page.locator('aside').first();
    await expect(sidebar.getByRole('link', { name: 'Groups' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Task access/i })).toHaveCount(0);
  });

  test('the catalog checks are reported (reporting only)', async ({ context, baseURL }, testInfo) => {
    const session = (await context.cookies()).find((c) => c.name === 'it_aware_access');
    expect(session).toBeTruthy();
    const access = await taskAccess(`it_aware_access=${session!.value}`);
    expect(access.tasks.length).toBeGreaterThan(0);

    // Check 1: every page belongs to a task.
    const root = path.join(process.cwd(), 'app/(main)');
    const pages = pageFiles(root).map((file) => path.relative(process.cwd(), file));
    const withoutTask = pagesWithoutTask(pages, access.tasks);

    // Check 2: a task a user account has opens for it. Each user account that
    // signs in with the e2e password asks for the page of each of its tasks; a
    // redirect (to the login or access-denied page) or an error answer is
    // reported. It does not see what a page loads after it renders.
    const opens = new Map(access.tasks.map((task) => [task.code, task.opens]));
    const notOpening: { username: string; task: string; opens: string; answer: string }[] = [];
    const notSignedIn: string[] = [];
    let opened = 0;
    for (const account of access.accounts) {
      if (account.account_type !== 'user' || !account.is_active || account.tasks.length === 0) continue;
      const api = await request.newContext();
      const login = await api.post(`${API_URL}/auth/session/token`, {
        form: { grant_type: 'password', username: account.username, password: PASSWORD },
      });
      const cookie = (login.headers()['set-cookie'] ?? '').match(/it_aware_access=[^;]+/)?.[0];
      await api.dispose();
      if (!login.ok() || !cookie) {
        notSignedIn.push(account.username);
        continue;
      }
      const browserless = await request.newContext({ baseURL, extraHTTPHeaders: { Cookie: cookie } });
      for (const held of account.tasks) {
        const address = opens.get(held.code)!;
        const response = await browserless.get(address, { maxRedirects: 0 });
        opened += 1;
        if (response.status() !== 200) {
          const to = response.headers()['location'];
          notOpening.push({
            username: account.username,
            task: held.code,
            opens: address,
            answer: to ? `${response.status()} to ${to}` : String(response.status()),
          });
        }
      }
      await browserless.dispose();
    }

    const report = {
      tasks: access.tasks.length,
      pages: pages.length,
      pages_without_task: withoutTask,
      task_pages_asked: opened,
      tasks_not_opening: notOpening,
      accounts_not_signed_in: notSignedIn,
    };
    const body = JSON.stringify(report, null, 2);
    fs.writeFileSync(testInfo.outputPath('tasks-checks.json'), body);
    await testInfo.attach('tasks-checks.json', { body, contentType: 'application/json' });
    console.log(
      `tasks-checks: ${withoutTask.length} of ${pages.length} pages belong to no task; ` +
      `${notOpening.length} of ${opened} task pages did not open`
    );
  });
});
