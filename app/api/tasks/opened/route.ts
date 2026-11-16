import { recordOpened } from '@/lib/api/tasks';

/**
 * API route the task frame tells which task's page the person opened.
 * POST /api/tasks/opened  {"task": "<code>", "view": "<slug>"}
 *
 * A plain fetch, not a server action: a server action goes through the app
 * router's queue, and one still running when a page redirects while it loads
 * (a refused task to /access-denied, an ended sign-in to /login) broke the
 * router with React error #310. Recents are a convenience, so this never fails
 * the page: it answers 204 whatever the backend says.
 */
export async function POST(request: Request) {
    const body: unknown = await request.json().catch(() => null);
    const { task, view } = (body ?? {}) as { task?: unknown; view?: unknown };
    if (typeof task === 'string' && typeof view === 'string') {
        try {
            await recordOpened(task, view);
        } catch {
            // Not one of their tasks, an ended sign-in, or the backend down: nothing to keep.
        }
    }
    return new Response(null, { status: 204 });
}
