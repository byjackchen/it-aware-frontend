import { test, expect } from '@playwright/test';

/**
 * The theme (feat/home-search-light): light is the default for anyone who has
 * not chosen one; a person who chose keeps their choice (the `it-aware-theme`
 * cookie), and dark stays available from the top bar.
 */

const PAGE_GREY = 'rgb(244, 246, 249)';

test.describe('The theme', () => {
  test('a person who has not chosen a theme sees the light one', async ({ page, context }) => {
    expect((await context.cookies()).some((cookie) => cookie.name === 'it-aware-theme')).toBe(false);
    const answer = await page.goto('/tasks/workers/workers');
    // The server draws the page light from the start: no dark first paint.
    expect(await answer!.text()).toMatch(/<html[^>]*class="light"/);

    await expect(page.locator('html')).toHaveClass(/(^| )light( |$)/);
    await expect(page.locator('body')).toHaveClass(/(^| )theme-light( |$)/);
    // A soft grey page with white surfaces; nobody chose it, so nothing was stored.
    await expect(page.locator('body')).toHaveCSS('background-color', PAGE_GREY);
    await expect(page.getByTestId('task-frame')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
    expect((await context.cookies()).some((cookie) => cookie.name === 'it-aware-theme')).toBe(false);
  });

  test('a person who chose dark keeps it, and can go back to light', async ({ page, context }) => {
    const chosen = async () => (await context.cookies()).find((cookie) => cookie.name === 'it-aware-theme')?.value;
    await page.goto('/tasks/workers/workers');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveClass(/(^| )dark( |$)/);
    expect(await chosen()).toBe('dark');

    // The choice is stored: the server draws the next page dark from the start.
    const answer = await page.goto('/tasks/workers/organizations');
    expect(await answer!.text()).toMatch(/<html[^>]*class="dark"/);
    await expect(page.locator('body')).toHaveClass(/(^| )theme-dark( |$)/);
    await expect(page.locator('body')).not.toHaveCSS('background-color', PAGE_GREY);

    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(page.locator('html')).toHaveClass(/(^| )light( |$)/);
    await expect(page.locator('body')).toHaveCSS('background-color', PAGE_GREY);
    expect(await chosen()).toBe('light');
  });

  test('the login page is light for a visitor who has not chosen', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto('/auth/login');
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/(^| )light( |$)/);
    await context.close();
  });
});
