import { test, expect, type Page } from '@playwright/test';
import { USERNAME } from './env';

/**
 * View Usages, who used what (feat/usage-who-icons; backend 358c5ef, specs/backend
 * api_specs_usage.md "Who"): By Person and one person's usage, the people of
 * one task reached from By Task. The
 * stack records real events: the setup's sign-in, and every task page a spec
 * opens. The specs act as the synthetic admin (USERNAME, gate.admin in the
 * gate), who holds every task. Counts are at least, not exactly: the specs
 * share one backend and its record.
 */

const BASE = '/tasks/usages';

/** Open an address of the task and wait until its page is there once, with its requests done. */
async function open(page: Page, path: string, heading: string) {
  await page.goto(`${BASE}/${path}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toHaveCount(1);
}

/** Open a task's page, and wait until the frame has told the backend it was opened. */
async function openTask(page: Page, address: string) {
  await page.goto(address);
  await expect(page.getByTestId('task-frame')).toBeVisible();
  await page.waitForLoadState('networkidle');
}

test.describe('View Usages: who used what', () => {
  test('a holder sees the people active in the window, and opens one', async ({ page }) => {
    await openTask(page, '/tasks/workers/organizations');
    await openTask(page, '/tasks/it-tickets/vip');

    await open(page, 'people', 'By Person');
    const tabs = page.getByTestId('task-frame').getByRole('navigation', { name: 'Views of View Usages' });
    await expect(tabs.getByRole('link', { name: 'By Person' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('people-summary')).toHaveText(/^\d+ (person|people) active in the last 30 days$/);

    // The admin signed in and opened the two tasks above.
    const me = page.getByTestId('people-table').locator('tbody tr').filter({ has: page.getByRole('link', { name: USERNAME, exact: true }) });
    await expect(me).toHaveCount(1);
    const [signIns, taskOpens, tasks] = (await me.locator('td').allInnerTexts()).slice(1, 4).map((text) => Number(text.replace(/,/g, '')));
    expect(signIns).toBeGreaterThanOrEqual(1);
    expect(taskOpens).toBeGreaterThanOrEqual(2);
    expect(tasks).toBeGreaterThanOrEqual(2);

    // The window is kept in the person's address.
    await page.getByRole('navigation', { name: 'Window' }).getByRole('link', { name: '7 days' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/people\\?days=7$`));
    await expect(page.getByTestId('people-summary')).toHaveText(/active in the last 7 days$/);
    await page.getByTestId('people-table').getByRole('link', { name: USERNAME, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/people/[\\w-]{22}\\?days=7$`));
    await expect(page.getByRole('heading', { level: 1, name: USERNAME, exact: true })).toHaveCount(1);
    await page.waitForLoadState('networkidle');

    // Still By Person's page: its tab is the current one, and the way back keeps the window.
    await expect(tabs.getByRole('link', { name: 'By Person' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: 'Back to By Person' })).toHaveAttribute('href', `${BASE}/people?days=7`);
    await expect(page.getByTestId('person-summary')).toHaveText(/^\d+ sign-ins? and \d+ tasks? opened in the last 7 days$/);

    // Each task they opened: named from the catalog, linked where the viewer holds it, with the views opened.
    const workers = page.getByTestId('person-task-workers');
    await expect(workers.getByRole('link', { name: 'Maintain Workers and Organizations', exact: true })).toHaveAttribute(
      'href',
      '/tasks/workers/workers',
    );
    await expect(workers).toContainText('Organizations');
    const tickets = page.getByTestId('person-task-it-tickets');
    await expect(tickets.getByRole('link', { name: 'Monitor IT Tickets', exact: true })).toBeVisible();
    await expect(tickets).toContainText('VIP Tickets');

    // The window changes on the person's own page.
    await page.getByRole('navigation', { name: 'Window' }).getByRole('link', { name: '90 days' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/people/[\\w-]{22}\\?days=90$`));
    await expect(page.getByTestId('person-summary')).toHaveText(/opened in the last 90 days$/);
  });

  test("by task: a task's People number opens the people who opened it", async ({ page }) => {
    await openTask(page, '/tasks/workers/organizations');
    await open(page, 'tasks?days=7', 'By Task');

    const people = page.getByTestId('usage-task-row-workers').getByTestId('usage-task-people').getByRole('link');
    await expect(people).toHaveAttribute('href', `${BASE}/tasks/workers?days=7`);
    const count = Number(await people.innerText());
    expect(count).toBeGreaterThanOrEqual(1);
    await people.click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/tasks/workers\\?days=7$`));
    await expect(
      page.getByRole('heading', { level: 1, name: 'People who opened Maintain Workers and Organizations', exact: true }),
    ).toHaveCount(1);
    await page.waitForLoadState('networkidle');

    // By Task's page still: its tab is current, and the way back keeps the window.
    const tabs = page.getByTestId('task-frame').getByRole('navigation', { name: 'Views of View Usages' });
    await expect(tabs.getByRole('link', { name: 'By Task' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('link', { name: 'Back to By Task' })).toHaveAttribute('href', `${BASE}/tasks?days=7`);
    await expect(page.getByTestId('task-people-summary')).toHaveText(
      new RegExp(`^${count} (person|people) opened it in the last 7 days$`),
    );

    // The admin opened it at Organizations; their name opens their usage, the window kept.
    const me = page.getByTestId('task-people-table').locator('tbody tr').filter({ has: page.getByRole('link', { name: USERNAME, exact: true }) });
    await expect(me).toHaveCount(1);
    await expect(me).toContainText('Organizations');
    expect(Number(await me.locator('td').nth(1).innerText())).toBeGreaterThanOrEqual(1);
    await expect(me.getByRole('link', { name: USERNAME, exact: true })).toHaveAttribute(
      'href',
      new RegExp(`^${BASE}/people/[\\w-]{22}\\?days=7$`),
    );

    // The window changes on the task's own page.
    await page.getByRole('navigation', { name: 'Window' }).getByRole('link', { name: '30 days' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/tasks/workers$`));
    await expect(page.getByTestId('task-people-summary')).toHaveText(/opened it in the last 30 days$/);

    // A code that is no task: the backend's answer, on the page.
    await open(page, 'tasks/nowhere', 'People who opened nowhere');
    await expect(page.getByText(/^Could not load this: /)).toBeVisible();
  });
});
