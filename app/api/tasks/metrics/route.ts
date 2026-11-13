import { NextResponse } from 'next/server';
import { getTaskMetrics } from '@/lib/api/tasks';
import type { TaskMetrics } from '@/lib/types/tasks';

/**
 * API route behind the key metrics on the home's task cards.
 * GET /api/tasks/metrics
 *
 * The home asks it once, after its cards are drawn. It answers the backend's
 * metrics (GET /tasks/metrics), and none when the backend has none or fails:
 * the cards then stay plain, and the home never waits on it or breaks.
 */
export async function GET() {
    const none: TaskMetrics = { metrics: [] };
    try {
        return NextResponse.json((await getTaskMetrics()) ?? none);
    } catch (error) {
        console.error('Task metrics failed:', error);
        return NextResponse.json(none);
    }
}
