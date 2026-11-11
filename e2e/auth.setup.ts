import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import { USERNAME, PASSWORD } from './env';

const STORAGE_STATE = path.join(__dirname, '.auth/user.json');

setup('authenticate as the E2E user', async ({ page, context }) => {
  await page.goto('/auth/login');
  await page.locator('#username').fill(USERNAME);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /^Login$/ }).click();

  // login() server action sets HTTPOnly cookies, then the client does window.location.href='/'.
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'), { timeout: 20_000 });

  // Verify the access cookie actually landed; otherwise downstream tests will redirect.
  await expect
    .poll(
      async () => (await context.cookies()).some((c) => c.name === 'it_aware_access'),
      { timeout: 5_000 }
    )
    .toBe(true);

  await context.storageState({ path: STORAGE_STATE });
});
