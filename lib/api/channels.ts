/**
 * Channel + Channel Members + Channel Messages API client.
 *
 * Client-safe — uses the Next.js BFF proxy at /api/agentops/channels/* which
 * forwards to backend /objects/agentops/channels/*. See
 * app/api/agentops/[...path]/route.ts.
 *
 * Phase 2 of agentops — see backend spec
 * docs/superpowers/specs/2026-05-19-agentops-phase2-channel-design.md.
 */

const BASE = '/api/agentops/channels';

// ---------- Types ----------

export interface Channel {
    oid: string;
    name: string;
    description?: string | null;
    created_by_account_oid: string;
    is_active: boolean;
    is_dm?: boolean;
    archived_at?: string | null;
    tags: string[];
    created_at: string;
    updated_at: string;
    member_count?: number | null;
    unread_count?: number | null;
    last_message_at?: string | null;
}

export interface ChannelListResponse {
    items: Channel[];
    total: number;
    skip: number;
    limit: number;
}

export interface ChannelCreate {
    name: string;
    description?: string | null;
    tags?: string[];
}

export interface ChannelUpdate {
    name?: string;
    description?: string | null;
    tags?: string[];
}

export interface ChannelMember {
    channel_oid: string;
    agent_oid: string;
    agent_name?: string | null;
    joined_at: string;
    joined_via_message_oid?: string | null;
}

export interface ChannelMemberListResponse {
    items: ChannelMember[];
    total: number;
}

export type ChannelMessageKind = 'human_post' | 'agent_reply' | 'system_note';

export interface ChannelMessageReaction {
    emoji: string;
    count: number;
    accounts: string[];
    mine: boolean;
}

export interface ChannelMessage {
    oid: string;
    channel_oid: string;
    kind: ChannelMessageKind;
    body: string;
    author_account_oid?: string | null;
    run_oid?: string | null;
    mentioned_agent_oids: string[];
    reply_to_message_oid?: string | null;
    created_at: string;
    edited_at?: string | null;
    deleted_at?: string | null;
    pinned_at?: string | null;
    pinned_by_account_oid?: string | null;
    reactions: ChannelMessageReaction[];
    reply_count: number;
}

export interface ChannelMessageListResponse {
    items: ChannelMessage[];
    has_more: boolean;
    next_cursor?: string | null;
}

export interface ChannelMessagePost {
    body: string;
    reply_to_message_oid?: string;
    metadata?: Record<string, unknown>;
}

// ---------- Client fetch helper ----------

async function clientFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(path, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
        ...options,
    });
    if (!res.ok) {
        let detail = res.statusText;
        try {
            const body = await res.json();
            if (typeof body?.detail === 'string') detail = body.detail;
            else if (typeof body?.error === 'string') detail = body.error;
            else if (typeof body?.message === 'string') detail = body.message;
        } catch {
            // ignore — non-JSON error body
        }
        throw new Error(`${res.status} ${detail}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

// ---------- Channel CRUD ----------

export async function listChannels(params?: {
    tag?: string;
    is_active?: boolean;
    skip?: number;
    limit?: number;
}): Promise<ChannelListResponse> {
    const q = new URLSearchParams();
    if (params?.tag) q.set('tag', params.tag);
    if (params?.is_active !== undefined) q.set('is_active', String(params.is_active));
    if (params?.skip !== undefined) q.set('skip', String(params.skip));
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    return clientFetch<ChannelListResponse>(`${BASE}?${q.toString()}`);
}

export async function listMyChannels(params?: {
    is_active?: boolean;
    skip?: number;
    limit?: number;
}): Promise<ChannelListResponse> {
    const q = new URLSearchParams();
    if (params?.is_active !== undefined) q.set('is_active', String(params.is_active));
    if (params?.skip !== undefined) q.set('skip', String(params.skip));
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    return clientFetch<ChannelListResponse>(`${BASE}/mine?${q.toString()}`);
}

export async function getChannel(oid: string): Promise<Channel> {
    return clientFetch<Channel>(`${BASE}/${oid}`);
}

export async function createChannel(data: ChannelCreate): Promise<Channel> {
    return clientFetch<Channel>(BASE, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateChannel(oid: string, data: ChannelUpdate): Promise<Channel> {
    return clientFetch<Channel>(`${BASE}/${oid}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function archiveChannel(oid: string): Promise<void> {
    await clientFetch<void>(`${BASE}/${oid}`, { method: 'DELETE' });
}

// ---------- Members ----------

export async function listMembers(channelOid: string): Promise<ChannelMemberListResponse> {
    return clientFetch<ChannelMemberListResponse>(`${BASE}/${channelOid}/members`);
}

export async function removeMember(channelOid: string, agentOid: string): Promise<void> {
    await clientFetch<void>(`${BASE}/${channelOid}/members/${agentOid}`, {
        method: 'DELETE',
    });
}

// ---------- Messages ----------

export async function listMessages(
    channelOid: string,
    params?: { before?: string; limit?: number },
): Promise<ChannelMessageListResponse> {
    const q = new URLSearchParams();
    if (params?.before) q.set('before', params.before);
    if (params?.limit !== undefined) q.set('limit', String(params.limit));
    return clientFetch<ChannelMessageListResponse>(
        `${BASE}/${channelOid}/messages?${q.toString()}`,
    );
}

export async function postMessage(
    channelOid: string,
    data: ChannelMessagePost,
): Promise<ChannelMessage & { unresolved_mentions?: string[] }> {
    return clientFetch<ChannelMessage & { unresolved_mentions?: string[] }>(
        `${BASE}/${channelOid}/messages`,
        { method: 'POST', body: JSON.stringify(data) },
    );
}

export async function editMessage(
    channelOid: string,
    messageOid: string,
    body: string,
): Promise<ChannelMessage> {
    return clientFetch<ChannelMessage>(
        `${BASE}/${channelOid}/messages/${messageOid}`,
        { method: 'PUT', body: JSON.stringify({ body }) },
    );
}

export async function deleteMessage(
    channelOid: string,
    messageOid: string,
): Promise<void> {
    await clientFetch<void>(`${BASE}/${channelOid}/messages/${messageOid}`, {
        method: 'DELETE',
    });
}

export async function toggleReaction(
    channelOid: string,
    messageOid: string,
    emoji: string,
): Promise<ChannelMessage> {
    return clientFetch<ChannelMessage>(
        `${BASE}/${channelOid}/messages/${messageOid}/reactions`,
        { method: 'POST', body: JSON.stringify({ emoji }) },
    );
}

export async function pinMessage(
    channelOid: string,
    messageOid: string,
    pin: boolean,
): Promise<ChannelMessage> {
    return clientFetch<ChannelMessage>(
        `${BASE}/${channelOid}/messages/${messageOid}/pin`,
        { method: pin ? 'POST' : 'DELETE' },
    );
}

export async function markChannelRead(channelOid: string): Promise<void> {
    await clientFetch<void>(`${BASE}/${channelOid}/read`, { method: 'POST' });
}

export async function getOrCreateDm(agentOid: string): Promise<Channel> {
    return clientFetch<Channel>(`${BASE}/dm`, {
        method: 'POST',
        body: JSON.stringify({ agent_oid: agentOid }),
    });
}

export interface GlobalSearchResponse {
    channels: Channel[];
    messages: ChannelMessage[];
    total: number;
}

export async function globalSearch(
    query: string,
    limit = 20,
): Promise<GlobalSearchResponse> {
    const q = new URLSearchParams({ q: query, limit: String(limit) });
    return clientFetch<GlobalSearchResponse>(`${BASE}/search?${q.toString()}`);
}

export async function searchChannelMessages(
    channelOid: string,
    query: string,
    limit = 50,
): Promise<{ items: ChannelMessage[]; total: number }> {
    const q = new URLSearchParams({ q: query, limit: String(limit) });
    return clientFetch<{ items: ChannelMessage[]; total: number }>(
        `${BASE}/${channelOid}/messages/search?${q.toString()}`,
    );
}

export async function listThreadReplies(
    channelOid: string,
    parentMessageOid: string,
    limit = 200,
): Promise<ChannelMessageListResponse> {
    const q = new URLSearchParams({
        parent: parentMessageOid,
        limit: String(limit),
    });
    return clientFetch<ChannelMessageListResponse>(
        `${BASE}/${channelOid}/messages?${q.toString()}`,
    );
}

export async function cancelRun(runOid: string): Promise<void> {
    await clientFetch<void>(`/api/agentops/runs/${runOid}/cancel`, {
        method: 'POST',
    });
}
