/**
 * Client-safe API for the channel ↔ ticket pivot endpoints.
 *
 * The plain ticket CRUD UI already lives elsewhere; this module exposes
 * only the surfaces the channel UI cares about — "open a task from this
 * message", "claim", "mark done", and "what tickets exist on this
 * message".
 */

const BASE = '/api/agentops/tickets';

export type TicketStatus =
    | 'open'
    | 'in_progress'
    | 'blocked'
    | 'done'
    | 'cancelled';

export interface Ticket {
    oid: string;
    title: string;
    body?: string | null;
    status: TicketStatus;
    assignee_account_oid?: string | null;
    created_by_account_oid: string;
    parent_ticket_oid?: string | null;
    channel_message_oid?: string | null;
    channel_oid?: string | null;
    tags: string[];
    priority: number;
    closed_at?: string | null;
    created_at: string;
    updated_at: string;
    has_active_run?: boolean | null;
}

interface TicketListResponse {
    items: Ticket[];
    total: number;
}

async function clientFetch<T>(
    path: string,
    options?: RequestInit,
): Promise<T> {
    const r = await fetch(path, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    });
    if (!r.ok) {
        let detail = r.statusText;
        try {
            const body = await r.json();
            if (typeof body?.detail === 'string') detail = body.detail;
            else if (typeof body?.error === 'string') detail = body.error;
        } catch {
            /* ignore */
        }
        throw new Error(`${r.status} ${detail}`);
    }
    if (r.status === 204) return null as T;
    return (await r.json()) as T;
}

export async function createTicketFromMessage(args: {
    channel_message_oid: string;
    title: string;
    body?: string;
    tags?: string[];
    priority?: number;
}): Promise<Ticket> {
    return clientFetch<Ticket>(`${BASE}/from-message`, {
        method: 'POST',
        body: JSON.stringify(args),
    });
}

export async function listTicketsForMessage(
    channelMessageOid: string,
): Promise<TicketListResponse> {
    return clientFetch<TicketListResponse>(
        `${BASE}/by-message/${channelMessageOid}`,
    );
}

export async function listTicketsForChannel(
    channelOid: string,
): Promise<TicketListResponse> {
    return clientFetch<TicketListResponse>(`${BASE}/by-channel/${channelOid}`);
}

export async function claimTicket(oid: string): Promise<Ticket> {
    return clientFetch<Ticket>(`${BASE}/${oid}/claim`, { method: 'POST' });
}

export async function markTicketDone(oid: string): Promise<Ticket> {
    return clientFetch<Ticket>(`${BASE}/${oid}/done`, { method: 'POST' });
}
