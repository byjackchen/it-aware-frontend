import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Regression e2e for the agentops ticket-reply dispatch fix
 * (backend commit 6b98dc3): when a comment can't be dispatched to an
 * agent, the UI must surface a system_note instead of silently doing
 * nothing.
 *
 * This test exercises the simplest of the three skip cases — no agent
 * assignee — because it's the only one we can reproduce without staging
 * an in-flight Knot run. The other two paths (active run, IntegrityError
 * race) are covered by the backend's tests/agentops/test_reply_dispatch_skips.py.
 *
 * Auth is established once by auth.setup.ts; this spec uses page.request
 * so the same it_aware_* cookies travel with the API calls.
 */

const TITLE = `[e2e-reply-skip ${Date.now()}] no-assignee dispatch note`;

async function fetchSelfAccountOid(req: APIRequestContext): Promise<string> {
    // The auth/me endpoint returns the current account; ticket creation needs an OID.
    const r = await req.get('/api/auth/me');
    expect(r.ok(), 'auth/me must respond').toBeTruthy();
    const me = (await r.json()) as { oid?: string; account?: { oid?: string } };
    const oid = me.oid ?? me.account?.oid;
    expect(typeof oid, 'auth/me must return an oid').toBe('string');
    return oid as string;
}

test('posting a comment on a no-agent-assignee ticket surfaces a system_note (not silent)', async ({
    page,
}) => {
    const selfOid = await fetchSelfAccountOid(page.request);

    // Create a ticket assigned to the human admin (byjackchen) — no AccountAgent
    // mapping, so the dispatch path falls into the "no agent assigned" skip.
    const createRes = await page.request.post('/api/agentops/tickets', {
        data: {
            title: TITLE,
            body: 'regression for the dispatch-skip system_note',
            status: 'in_progress',
            assignee_account_oid: selfOid,
        },
    });
    expect(createRes.ok(), `create ticket failed: ${await createRes.text()}`).toBeTruthy();
    const ticket = (await createRes.json()) as { oid: string };

    try {
        await page.goto(`/data/agentops/tickets/${ticket.oid}`);
        await expect(page.getByRole('heading', { name: /Ticket Details/i })).toBeVisible();
        // Wait until the empty thread settles (Conversation heading is the only
        // role=heading match for this text — there's a phantom truncated-ellipsis
        // span elsewhere on the page that also yields the same accessible name).
        await expect(
            page.getByRole('heading', { name: /^Conversation \(\d+\)$/ })
        ).toBeVisible({ timeout: 15_000 });

        // Two textareas with placeholder "Add a comment..." exist (CommentInput
        // is mounted once in the conversation column, once in a sub-thread
        // helper). The conversation column's input is the last visible one in
        // the DOM order.
        const textarea = page.locator('textarea[placeholder="Add a comment..."]').last();
        await textarea.fill('any agent home?');
        const postPromise = page.waitForResponse(
            (r) =>
                r.url().endsWith('/api/agentops/thread-messages') &&
                r.request().method() === 'POST'
        );
        await textarea.press('Meta+Enter');
        const post = await postPromise;
        // The Next.js proxy normalizes the backend's 201 to 200; either is fine.
        expect([200, 201], `POST status: ${await post.text()}`).toContain(post.status());

        // Polling fetches the thread on agentRunning flip; the system_note that
        // the backend wrote inside the POST handler is picked up on the next
        // reload. Wait directly for the assertion.
        await expect(
            page.getByText(/No agent is assigned/i).first()
        ).toBeVisible({ timeout: 10_000 });
    } finally {
        await page.request.delete(`/api/agentops/tickets/${ticket.oid}`).catch(() => undefined);
    }
});
