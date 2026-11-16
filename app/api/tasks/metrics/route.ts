import { NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { getTaskMetrics } from '@/lib/api/tasks';
import type { TaskMetrics } from '@/lib/types/tasks';

/** One person's numbers: never kept by a cache. */
const headers = { 'Cache-Control': 'private, no-store' };

/** Whether a caught error is one of Next.js's own signals: here, the redirect to the login page on a 401. */
function isNextSignal(error: unknown): boolean {
    try {
        unstable_rethrow(error);
        return false;
    } catch {
        return true;
    }
}

/**
 * API route behind the key metrics on the home's task cards.
 * GET /api/tasks/metrics
 *
 * The home asks it once, after its cards are drawn. It answers the backend's
 * metrics, and none when the backend fails: the cards then stay
 * plain, and the home never waits on it or breaks. A person whose sign-in has
 * ended gets 401, not a redirect a fetch would follow to the login page.
 */
export async function GET() {
    const none: TaskMetrics = { metrics: [] };
    try {
        return NextResponse.json(await getTaskMetrics(), { headers });
    } catch (error) {
        if (isNextSignal(error)) {
            return NextResponse.json(none, { status: 401, headers });
        }
        console.error('Task metrics failed:', error);
        return NextResponse.json(none, { headers });
    }
}
