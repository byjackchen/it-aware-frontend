/**
 * AgentOps ActivityEvent client — read-only feed.
 *
 * Backend writes events from the dispatcher (run.started / run.completed /
 * run.failed / run.cancelled), the channel service (channel.*), and the
 * future ticket pipeline. The endpoint returns most-recent first.
 */

const BASE = '/api/agentops/activity-events';

export interface ActivityEvent {
    oid: string;
    action: string;
    actor_type?: string | null;
    actor_oid?: string | null;
    target_type?: string | null;
    target_oid?: string | null;
    workspace_id?: string | null;
    details?: Record<string, unknown> | null;
    occurred_at: string;
}

export interface ActivityEventListResponse {
    items: ActivityEvent[];
    total: number;
    skip: number;
    limit: number;
}

export interface ListActivityParams {
    since?: string;            // ISO timestamp
    action_prefix?: string;    // e.g. "run." or "channel."
    actor_type?: string;       // "account" | "agent" | "system"
    target_type?: string;      // "run" | "channel" | "ticket" | ...
    target_oid?: string;
    workspace_id?: string;
    skip?: number;
    limit?: number;
}

export async function listActivityEvents(
    params: ListActivityParams = {},
): Promise<ActivityEventListResponse> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    }
    const url = q.toString() ? `${BASE}?${q.toString()}` : BASE;
    const r = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!r.ok) {
        const txt = await r.text();
        throw new Error(`${r.status} ${txt || r.statusText}`);
    }
    return (await r.json()) as ActivityEventListResponse;
}
