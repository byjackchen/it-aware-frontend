import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { PASSWORD } from './env';

/**
 * A task page that redirects while it loads: a task the person does not hold
 * goes to /access-denied, and an ended sign-in goes to /login, with no client
 * exception on the way.
 *
 * Until the fix, the page's redirect arrived inside the streamed response while
 * the task frame's record of the opened page (then a server action) was still
 * pending in the app router's queue, and the router failed with React error
 * #310 ("Application error: a client-side exception has occurred"). A spec that
 * only checks where the page ends never saw it: Next.js recovers by loading the
 * target in full. So every test here fails on any page error.
 *
 * The account is gate.holder (ci/e2e/world.py): it holds View IT Interactions
 * and no administration task, so its task frame is a real one.
 */

/** Addresses of tasks gate.holder does not hold, one per way a page refuses. */
const REFUSED = [
  '/tasks/usages/overview', // lib/api/usage.ts load()
  '/tasks/jobs/jobs', // lib/api/jobs.ts read()
  '/tasks/features', // lib/api/features.ts
];

/** Sign in as gate.holder in a fresh context, collecting every page error. */
async function signIn(context: BrowserContext): Promise<{ page: Page; errors: string[] }> {
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/auth/login');
  await page.locator('#username').fill('gate.holder');
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /^Login$/ }).click();
  // The landing first: a navigation started before it would race the login's own.
  await page.waitForURL(/\/home$/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  return { page, errors };
}

test.describe('a task page that redirects while it loads', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('a task the person does not hold lands on the no-access page, with no client exception', async ({ browser }) => {
    const context = await browser.newContext();
    const { page, errors } = await signIn(context);
    for (const address of REFUSED) {
      await page.goto(address);
      await expect(page).toHaveURL(/\/access-denied$/);
      await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(errors, `opening ${address}`).toEqual([]);
    }
    await context.close();
  });

  test('an ended sign-in on a task page lands on the login page, with no client exception', async ({ browser }) => {
    const context = await browser.newContext();
    const { page, errors } = await signIn(context);
    const [access] = (await context.cookies()).filter((cookie) => cookie.name === 'it_aware_access');
    for (const address of [...REFUSED, '/tasks/it-interactions']) {
      // A token the backend no longer accepts: the signed-in one, cut short.
      await context.addCookies([{ ...access, value: access.value.slice(0, -8) }]);
      await page.goto(address);
      await expect(page).toHaveURL(/\/login(\?|$)/);
      await expect(page.locator('#username')).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(errors, `opening ${address}`).toEqual([]);
    }
    await context.close();
  });
});
