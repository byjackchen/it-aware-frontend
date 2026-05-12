import { test, expect, Page } from '@playwright/test';

/**
 * Auth module — full UI surface coverage.
 *
 * Walks the login flow + admin CRUD for accounts, groups, roles, permissions,
 * plus relationship management (account↔worker, account↔groups,
 * group↔permissions, group↔roles). Verified live via Playwright MCP before
 * codification; flows known to be broken are listed at the bottom of this file.
 *
 * Auth is established once by `auth.setup.ts` and shared via storageState.
 * The login-flow describe overrides that to use a fresh context.
 *
 * Pre-reqs:
 *   - Backend on localhost:8007, frontend on localhost:3007.
 *   - byjackchen exists with password=byjackchen and has admins membership.
 *   - Auth seeding (P0–P3) completed so the standard permissions/groups exist.
 *
 * Known bugs (intentionally NOT covered — would always fail):
 *   - BUG-001: Account → Unlink Worker silently fails. Frontend hits
 *     `DELETE /auth/config/account_workers/{accountOid}` but backend expects
 *     `DELETE /auth/config/account_workers/{accountOid}/{workerOid}`.
 *     See lib/api/security.ts:198 vs app/auth/routes.py:814.
 */

const RUN_ID = `qaauth${Date.now()}`;
const PERM_CODE = `qatest:perm_${RUN_ID}:verify`;

// --- helpers ---------------------------------------------------------------

async function clickByText(page: Page, text: string) {
  await page.getByRole('button', { name: text, exact: true }).first().click();
}

async function clickIconButton(page: Page, sectionHeading: string, title: string) {
  // Add/Remove buttons in AssignmentManager are icon-only with a title attribute.
  await page.locator(`button[title="${title}"]`).first().click();
}

async function waitForRedirectAway(page: Page, fromPath: string, timeoutMs = 10_000) {
  await page.waitForURL((url) => !url.pathname.startsWith(fromPath), { timeout: timeoutMs });
}

// --- login flow (fresh context, no storageState) ---------------------------

test.describe('Auth module — login flow', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('login page renders all expected controls', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input#username')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Login$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign in with Taihu/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ohla Chatbot/i })).toHaveAttribute(
      'href',
      /^wxwork:\/\/message\?uin=/
    );
  });

  test('?error= URL param renders error then strips the param', async ({ page }) => {
    await page.goto('/login?error=Session%20expired%20test');
    await expect(page.locator('text=Session expired test')).toBeVisible();
    expect(page.url()).not.toContain('?error=');
  });

  test('invalid password surfaces backend error message', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input#username').fill('byjackchen');
    await page.locator('input#password').fill('wrongpassword');
    await page.getByRole('button', { name: /^Login$/ }).click();
    await expect(page.locator('text=Invalid password')).toBeVisible();
  });

  test('nonexistent username surfaces backend error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input#username').fill(`nonexistent_${RUN_ID}`);
    await page.locator('input#password').fill('anything123');
    await page.getByRole('button', { name: /^Login$/ }).click();
    await expect(page.locator('text=Invalid username')).toBeVisible();
  });

  test('valid creds redirect to home and set access cookie', async ({ page, context }) => {
    await page.goto('/login');
    await page.locator('input#username').fill('byjackchen');
    await page.locator('input#password').fill('byjackchen');
    await page.getByRole('button', { name: /^Login$/ }).click();
    await waitForRedirectAway(page, '/login', 20_000);

    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === 'it_aware_access')).toBe(true);
  });
});

// --- authenticated tests (default storageState from auth.setup.ts) ---------

test.describe('Auth module — authenticated', () => {
  // Track created OIDs so we can clean up via API at the end.
  const created: {
    permissionOid?: string;
    roleOid?: string;
    groupUncOid?: string;
    groupSelfOid?: string;
    groupRbOid?: string;
    acctUserOid?: string;
    acctSysOid?: string;
    acctAgtOid?: string;
  } = {};

  test('GET /auth → 302 to /auth/permissions', async ({ page }) => {
    await page.goto('/auth');
    await expect(page).toHaveURL(/\/auth\/permissions$/);
  });

  // -- permissions --------------------------------------------------------

  test('create permission with live code preview', async ({ page }) => {
    await page.goto('/auth/permissions/new');

    // Code preview reads "domain:resource:action" until fields are filled.
    await expect(page.locator('text=domain:resource:action')).toBeVisible();

    await page.locator('input[placeholder="e.g., auth"]').fill('qatest');
    await page.locator('input[placeholder="e.g., users"]').fill(`perm_${RUN_ID}`);
    await page.locator('input[placeholder="e.g., read"]').fill('verify');

    // Live preview reflects the three inputs.
    await expect(page.locator(`text=${PERM_CODE}`)).toBeVisible();

    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForURL(/\/auth\/permissions$/);

    // List shows the new row.
    await expect(page.locator(`tbody tr:has-text("${PERM_CODE}")`)).toBeVisible();

    // Capture OID for later cleanup.
    await page.locator(`tbody tr:has-text("${PERM_CODE}")`).click();
    await page.waitForURL(/\/auth\/permissions\/[A-Za-z0-9_-]{22}$/);
    created.permissionOid = page.url().split('/').pop()!;
  });

  test('permission detail shows code + domain + resource + action + empty assigned-groups', async ({
    page,
  }) => {
    test.skip(!created.permissionOid, 'depends on create permission');
    await page.goto(`/auth/permissions/${created.permissionOid}`);
    await expect(page.locator(`text=${PERM_CODE}`)).toBeVisible();
    await expect(page.locator('text=qatest').first()).toBeVisible();
    await expect(page.locator(`text=perm_${RUN_ID}`).first()).toBeVisible();
    await expect(page.locator('text=verify').first()).toBeVisible();
    await expect(page.locator(/no groups|not assigned/i)).toBeVisible();
  });

  test('permission delete dismissal preserves entity', async ({ page }) => {
    test.skip(!created.permissionOid, 'depends on create permission');
    await page.goto(`/auth/permissions/${created.permissionOid}`);
    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: /^Delete$/ }).click();
    // Still on detail page, entity intact.
    await expect(page).toHaveURL(new RegExp(`/auth/permissions/${created.permissionOid}$`));
    await expect(page.locator(`text=${PERM_CODE}`)).toBeVisible();
  });

  // -- roles --------------------------------------------------------------

  test('create role with include_descendants flag', async ({ page }) => {
    await page.goto('/auth/roles/new');
    await page.locator('input[placeholder="e.g., Manager"]').fill(`role_${RUN_ID}`);
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForURL(/\/auth\/roles$/);

    const row = page.locator(`tbody tr:has-text("role_${RUN_ID}")`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(/Yes/);

    await row.click();
    await page.waitForURL(/\/auth\/roles\/[A-Za-z0-9_-]{22}$/);
    created.roleOid = page.url().split('/').pop()!;
  });

  test('role edit renames and toggles include_descendants', async ({ page }) => {
    test.skip(!created.roleOid, 'depends on create role');
    await page.goto(`/auth/roles/${created.roleOid}`);
    await page.getByRole('button', { name: /^Edit$/ }).click();

    // Scope to <main> to dodge the header search input.
    await page.locator('main input[type="text"]').fill(`role_${RUN_ID}_edited`);
    await page.locator('input[type="checkbox"]').uncheck();
    await page.getByRole('button', { name: /^Save$/ }).click();

    await expect(page.locator(`text=role_${RUN_ID}_edited`)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Save$/ })).toHaveCount(0);
  });

  test('role detail shows linked-groups read-only section (initially empty)', async ({ page }) => {
    test.skip(!created.roleOid, 'depends on create role');
    await page.goto(`/auth/roles/${created.roleOid}`);
    await expect(page.getByText(/Linked Groups|no groups/i).first()).toBeVisible();
  });

  // -- groups (and assignments) ------------------------------------------

  test('create three groups — one per scope type', async ({ page }) => {
    // unconstrained
    await page.goto('/auth/groups/new');
    await page.locator('input[placeholder="e.g., administrators"]').fill(`group_${RUN_ID}_unc`);
    await page.locator('select').selectOption('unconstrained');
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForURL(/\/auth\/groups$/);

    // self_scoped
    await page.goto('/auth/groups/new');
    await page.locator('input[placeholder="e.g., administrators"]').fill(`group_${RUN_ID}_self`);
    await page.locator('select').selectOption('self_scoped');
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForURL(/\/auth\/groups$/);

    // role_based
    await page.goto('/auth/groups/new');
    await page.locator('input[placeholder="e.g., administrators"]').fill(`group_${RUN_ID}_rb`);
    await page.locator('select').selectOption('role_based');
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForURL(/\/auth\/groups$/);

    // Verify list shows all three with correct scope badges.
    await expect(page.locator(`tbody tr:has-text("group_${RUN_ID}_unc")`)).toContainText(
      /Unconstrained/
    );
    await expect(page.locator(`tbody tr:has-text("group_${RUN_ID}_self")`)).toContainText(
      /Self Scoped/
    );
    await expect(page.locator(`tbody tr:has-text("group_${RUN_ID}_rb")`)).toContainText(
      /Role Based/
    );

    // Capture OIDs by clicking each.
    await page.locator(`tbody tr:has-text("group_${RUN_ID}_unc")`).click();
    await page.waitForURL(/\/auth\/groups\/[A-Za-z0-9_-]{22}$/);
    created.groupUncOid = page.url().split('/').pop()!;

    await page.goto('/auth/groups');
    await page.locator(`tbody tr:has-text("group_${RUN_ID}_self")`).click();
    await page.waitForURL(/\/auth\/groups\/[A-Za-z0-9_-]{22}$/);
    created.groupSelfOid = page.url().split('/').pop()!;

    await page.goto('/auth/groups');
    await page.locator(`tbody tr:has-text("group_${RUN_ID}_rb")`).click();
    await page.waitForURL(/\/auth\/groups\/[A-Za-z0-9_-]{22}$/);
    created.groupRbOid = page.url().split('/').pop()!;
  });

  test('self_scoped group detail hides Roles section (conditional render)', async ({ page }) => {
    test.skip(!created.groupSelfOid, 'depends on create groups');
    await page.goto(`/auth/groups/${created.groupSelfOid}`);
    await expect(page.getByRole('heading', { name: 'Permissions', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Roles', level: 3 })).toHaveCount(0);
  });

  test('role_based group detail shows both Permissions and Roles sections', async ({ page }) => {
    test.skip(!created.groupRbOid, 'depends on create groups');
    await page.goto(`/auth/groups/${created.groupRbOid}`);
    await expect(page.getByRole('heading', { name: 'Permissions', level: 3 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Roles', level: 3 })).toBeVisible();
  });

  test('group permission assign + remove via AssignmentManager', async ({ page }) => {
    test.skip(
      !created.groupRbOid || !created.permissionOid,
      'depends on create group_rb and permission'
    );
    await page.goto(`/auth/groups/${created.groupRbOid}`);

    // Open the AssignmentManager combobox for Permissions.
    await page.locator('button[title="Add permissions"]').click();
    await page
      .locator('select')
      .filter({ has: page.locator(`option[value="${created.permissionOid}"]`) })
      .first()
      .selectOption(created.permissionOid!);
    await page.getByRole('button', { name: /^Add$/ }).click();

    const tag = page.locator(`[class*="theme-tag"]:has-text("${PERM_CODE}")`);
    await expect(tag).toBeVisible();
    await expect(page.locator('text=No permissions assigned')).toHaveCount(0);

    // Remove the assignment via the tag's red-icon button.
    await tag.locator('button').click();
    await expect(page.locator(`text=${PERM_CODE}`)).toHaveCount(0);
    await expect(page.locator('text=No permissions assigned')).toBeVisible();
  });

  test('group role link surfaces in role-detail linked-groups (bidirectional)', async ({
    page,
  }) => {
    test.skip(!created.groupRbOid || !created.roleOid, 'depends on group_rb and role');
    await page.goto(`/auth/groups/${created.groupRbOid}`);

    await page.locator('button[title="Add roles"]').click();
    await page
      .locator('select')
      .filter({ has: page.locator(`option[value="${created.roleOid}"]`) })
      .first()
      .selectOption(created.roleOid!);
    await page.getByRole('button', { name: /^Add$/ }).click();
    await expect(page.locator(`text=role_${RUN_ID}_edited`).first()).toBeVisible();

    // Bidirectional: open the role and confirm group appears there.
    await page.goto(`/auth/roles/${created.roleOid}`);
    await expect(page.locator(`text=group_${RUN_ID}_rb`).first()).toBeVisible();
  });

  // -- accounts ----------------------------------------------------------

  test('account create form conditionally shows password for system/agent', async ({ page }) => {
    await page.goto('/auth/accounts/new');
    // Default = user → no password field.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await page.locator('select').selectOption('system');
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await page.locator('select').selectOption('agent');
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await page.locator('select').selectOption('user');
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('create three accounts — user / system / agent', async ({ page }) => {
    // user
    await page.goto('/auth/accounts/new');
    await page.locator('input[placeholder="e.g., john.doe"]').fill(`acct_${RUN_ID}_usr`);
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForURL(/\/auth\/accounts$/);

    // system
    await page.goto('/auth/accounts/new');
    await page.locator('select').selectOption('system');
    await page.locator('input[placeholder="e.g., john.doe"]').fill(`acct_${RUN_ID}_sys`);
    await page.locator('input[type="password"]').fill('qatest_pwd_8chars');
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForURL(/\/auth\/accounts$/);

    // agent
    await page.goto('/auth/accounts/new');
    await page.locator('select').selectOption('agent');
    await page.locator('input[placeholder="e.g., john.doe"]').fill(`acct_${RUN_ID}_agt`);
    await page.locator('input[type="password"]').fill('qatest_pwd_8chars');
    await page.getByRole('button', { name: /^Create$/ }).click();
    await page.waitForURL(/\/auth\/accounts$/);

    // Verify list rows + type badges.
    await expect(page.locator(`tbody tr:has-text("acct_${RUN_ID}_usr")`)).toContainText(/User/);
    await expect(page.locator(`tbody tr:has-text("acct_${RUN_ID}_sys")`)).toContainText(/System/);
    await expect(page.locator(`tbody tr:has-text("acct_${RUN_ID}_agt")`)).toContainText(/Agent/);

    // Capture OIDs.
    await page.locator(`tbody tr:has-text("acct_${RUN_ID}_usr")`).click();
    await page.waitForURL(/\/auth\/accounts\/[A-Za-z0-9_-]{22}$/);
    created.acctUserOid = page.url().split('/').pop()!;

    await page.goto('/auth/accounts');
    await page.locator(`tbody tr:has-text("acct_${RUN_ID}_sys")`).click();
    created.acctSysOid = page.url().split('/').pop()!;

    await page.goto('/auth/accounts');
    await page.locator(`tbody tr:has-text("acct_${RUN_ID}_agt")`).click();
    created.acctAgtOid = page.url().split('/').pop()!;
  });

  test('user account detail shows Link Worker; system/agent hide it', async ({ page }) => {
    test.skip(
      !created.acctUserOid || !created.acctSysOid || !created.acctAgtOid,
      'depends on accounts'
    );
    await page.goto(`/auth/accounts/${created.acctUserOid}`);
    await expect(page.getByRole('heading', { name: 'Linked Worker', level: 3 })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Link Worker$/ })).toBeVisible();

    await page.goto(`/auth/accounts/${created.acctSysOid}`);
    await expect(page.getByRole('heading', { name: 'Linked Worker', level: 3 })).toHaveCount(0);

    await page.goto(`/auth/accounts/${created.acctAgtOid}`);
    await expect(page.getByRole('heading', { name: 'Linked Worker', level: 3 })).toHaveCount(0);
  });

  test('link a worker to user account via WorkerSearchDialog', async ({ page }) => {
    test.skip(!created.acctUserOid, 'depends on create user account');
    await page.goto(`/auth/accounts/${created.acctUserOid}`);
    await page.getByRole('button', { name: /^Link Worker$/ }).click();

    const dialog = page.locator('div.fixed.inset-0');
    await expect(dialog).toBeVisible();
    // Pick any worker in the (paginated) result by clicking the first row button
    // visible inside the dialog.
    const firstWorker = dialog.locator('button').filter({ hasText: /@/ }).first();
    await firstWorker.click();

    // Dialog closes and Unlink replaces Link Worker.
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Link Worker$/ })).toHaveCount(0);
    // NOTE: Unlink button exists but is BROKEN — see BUG-001 at top of file.
    // We don't drive it here; cleanup uses the backend directly.
  });

  test('assign group to system account via AssignmentManager', async ({ page }) => {
    test.skip(!created.acctSysOid || !created.groupUncOid, 'depends on accounts and group');
    await page.goto(`/auth/accounts/${created.acctSysOid}`);
    await page.locator('button[title="Add groups"]').click();
    await page.locator('select').first().selectOption(created.groupUncOid!);
    await page.getByRole('button', { name: /^Add$/ }).click();
    await expect(page.locator(`text=group_${RUN_ID}_unc`).first()).toBeVisible();
  });

  test('system account edit: toggle active off + password reset', async ({ page }) => {
    test.skip(!created.acctSysOid, 'depends on create system account');
    await page.goto(`/auth/accounts/${created.acctSysOid}`);
    await page.getByRole('button', { name: /^Edit$/ }).click();
    await page.locator('input[type="checkbox"]').uncheck();
    await page.locator('input[type="password"]').fill('new_pwd_8chars');
    await page.getByRole('button', { name: /^Save$/ }).click();

    // Out of edit mode and status now Inactive.
    await expect(page.getByRole('button', { name: /^Save$/ })).toHaveCount(0);
    await expect(page.locator('text=Inactive')).toBeVisible();
  });

  // -- cross-cutting -----------------------------------------------------

  test('access-denied page renders Go Back and Go Home', async ({ page }) => {
    await page.goto('/access-denied');
    await expect(page.getByRole('button', { name: /Go Back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Go Home/i })).toBeVisible();
  });

  test('logout clears access cookie and redirects unauthenticated traffic to /login', async ({
    page,
    context,
  }) => {
    await page.goto('/dashboard/data-overview');
    await page.locator('button').filter({ hasText: /^Logout$/ }).first().click();
    await page.waitForURL(/\/login$/, { timeout: 10_000 });

    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === 'it_aware_access')).toBe(false);

    // Protected route now bounces to /login.
    await page.goto('/auth/accounts');
    await page.waitForURL(/\/login/);
  });

  // -- cleanup ------------------------------------------------------------

  test.afterAll(async ({ request }) => {
    // Cleanup uses the backend directly (Next.js server actions are server-only).
    const tokenResp = await request.post('http://localhost:8007/auth/session/token', {
      form: { grant_type: 'password', username: 'byjackchen', password: 'byjackchen' },
    });
    const setCookie = tokenResp.headers()['set-cookie'] ?? '';
    const accessMatch = /it_aware_access=([^;]+)/.exec(setCookie);
    const headers = accessMatch ? { Cookie: `it_aware_access=${accessMatch[1]}` } : {};

    const deletes: Array<[string, string | undefined]> = [
      ['accounts', created.acctUserOid],
      ['accounts', created.acctSysOid],
      ['accounts', created.acctAgtOid],
      ['groups', created.groupUncOid],
      ['groups', created.groupSelfOid],
      ['groups', created.groupRbOid],
      ['roles', created.roleOid],
      ['permissions', created.permissionOid],
    ];

    // Also clean any account_worker the link test created — required because of
    // BUG-001 (UI unlink is broken). Iterate user accounts and force-delete links.
    if (created.acctUserOid) {
      const links = await request.get(
        `http://localhost:8007/auth/config/account_workers?account_oid=${created.acctUserOid}`,
        { headers }
      );
      if (links.ok()) {
        const rows = (await links.json()) as Array<{ account_oid: string; worker_oid: string }>;
        for (const row of rows) {
          await request.delete(
            `http://localhost:8007/auth/config/account_workers/${row.account_oid}/${row.worker_oid}`,
            { headers }
          );
        }
      }
    }

    for (const [resource, oid] of deletes) {
      if (!oid) continue;
      await request.delete(`http://localhost:8007/auth/config/${resource}/${oid}`, { headers });
    }
  });
});
