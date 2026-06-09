import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Verifies that the AgentOps ticket thread renders message bodies as
 * GitHub-flavored markdown rather than plain pre-wrapped text.
 *
 * Backed by react-markdown + remark-gfm. We cover the four shapes most
 * likely to land in real chat traffic:
 *   - inline bold
 *   - fenced code block
 *   - bullet list
 *   - autolink (gfm)
 *
 * Posting the comment via the API keeps the test focused on rendering —
 * UI input parity is covered by qa-agentops-reply-skip.
 */

const TITLE = `[e2e-md ${Date.now()}] markdown thread rendering`;
const BODY = [
    'Hello, this is **bold** and a link to https://example.com.',
    '',
    '- item one',
    '- item two',
    '',
    '```python',
    'print("hi")',
    '```',
].join('\n');

async function fetchSelfAccountOid(req: APIRequestContext): Promise<string> {
    const r = await req.get('/api/auth/me');
    expect(r.ok()).toBeTruthy();
    const me = (await r.json()) as { oid?: string; account?: { oid?: string } };
    return (me.oid ?? me.account?.oid) as string;
}

test('thread renders bold, links, lists, and code as markdown', async ({ page }) => {
    const selfOid = await fetchSelfAccountOid(page.request);

    const createRes = await page.request.post('/api/agentops/tickets', {
        data: {
            title: TITLE,
            body: 'markdown rendering smoke',
            status: 'in_progress',
            assignee_account_oid: selfOid,
        },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const ticket = (await createRes.json()) as { oid: string };

    try {
        // Seed the thread directly so we don't depend on UI input timing.
        const post = await page.request.post('/api/agentops/thread-messages', {
            data: { ticket_oid: ticket.oid, body: BODY },
        });
        expect(post.ok(), await post.text()).toBeTruthy();

        await page.goto(`/data/agentops/tickets/${ticket.oid}`);
        await expect(
            page.getByRole('heading', { name: /Ticket Details/i })
        ).toBeVisible();

        // 1. Bold renders to an actual <strong>, not raw asterisks.
        await expect(page.locator('strong', { hasText: 'bold' }).first()).toBeVisible();

        // 2. The bare URL is autolinked (GFM).
        await expect(
            page.locator('a[href="https://example.com"]').first()
        ).toBeVisible();

        // 3. List items are real <li>s, two of them.
        await expect(page.locator('li', { hasText: 'item one' }).first()).toBeVisible();
        await expect(page.locator('li', { hasText: 'item two' }).first()).toBeVisible();

        // 4. Fenced code block gets language-python and the content stays whole.
        const codeBlock = page.locator('code.language-python').first();
        await expect(codeBlock).toBeVisible();
        await expect(codeBlock).toContainText('print("hi")');

        // Sanity: the raw markdown markers must NOT be visible anywhere in the
        // bubble — that would mean we fell back to plain text rendering.
        const conversation = page
            .getByRole('heading', { name: /^Conversation \(\d+\)$/ })
            .locator('..')
            .locator('..');
        await expect(conversation).not.toContainText('**bold**');
        await expect(conversation).not.toContainText('```python');
    } finally {
        await page.request.delete(`/api/agentops/tickets/${ticket.oid}`).catch(() => undefined);
    }
});
