'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
    listMembers,
    listMessages,
    markChannelRead,
    postMessage,
} from '@/lib/api/channels';
import type { ChannelMember, ChannelMessage } from '@/lib/api/channels';
import type { RunActivity } from './ThinkingPanel';

/**
 * Channel realtime stream — WebSocket primary, polling fallback.
 *
 * Connects to /ws on the backend (URL fetched via /api/agentops/ws-url so
 * the browser dials BACKEND_PUBLIC_DOMAIN). Subscribes to ``channel:<oid>``
 * and ``all``. On every WS event for this channel, refreshes the relevant
 * slice. Also tracks live ``run.*`` events so the ThinkingPanel can show
 * what each in-flight agent is doing.
 *
 * On WS close, polls every 3 s until reconnected.
 */
export function useChannelStream(channelOid: string) {
    const [messages, setMessages] = useState<ChannelMessage[]>([]);
    const [members, setMembers] = useState<ChannelMember[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [activeRuns, setActiveRuns] = useState<Map<string, RunActivity>>(
        () => new Map(),
    );
    const wsRef = useRef<WebSocket | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refreshMessages = useCallback(async () => {
        try {
            const r = await listMessages(channelOid, { limit: 100 });
            setMessages(r.items);
        } catch {
            // ignore
        }
    }, [channelOid]);

    const refreshMembers = useCallback(async () => {
        try {
            const r = await listMembers(channelOid);
            setMembers(r.items);
        } catch {
            // ignore
        }
    }, [channelOid]);

    const send = useCallback(
        async (body: string): Promise<string[]> => {
            const r = await postMessage(channelOid, { body });
            await refreshMessages();
            return r.unresolved_mentions ?? [];
        },
        [channelOid, refreshMessages],
    );

    // Mark-read on initial load + whenever new messages arrive.
    useEffect(() => {
        if (messages.length === 0) return;
        markChannelRead(channelOid).catch(() => undefined);
    }, [channelOid, messages.length]);

    useEffect(() => {
        refreshMessages();
        refreshMembers();

        let cancelled = false;
        let wsUrl: string | null = null;

        function patchActiveRuns(
            runOid: string,
            patch: Partial<RunActivity> | null,
        ) {
            setActiveRuns((prev) => {
                const next = new Map(prev);
                if (patch === null) {
                    next.delete(runOid);
                    return next;
                }
                const existing = next.get(runOid) ?? {
                    run_oid: runOid,
                    thinking: '',
                    last_tool: null,
                    tool_phase: null,
                    started_at: Date.now(),
                };
                next.set(runOid, { ...existing, ...patch });
                return next;
            });
        }

        async function connect() {
            if (cancelled) return;
            if (!wsUrl) {
                try {
                    const r = await fetch('/api/agentops/ws-url', {
                        credentials: 'include',
                        cache: 'no-store',
                    });
                    if (!r.ok) throw new Error(`ws-url ${r.status}`);
                    const { ws_url } = (await r.json()) as { ws_url: string };
                    wsUrl = ws_url;
                } catch {
                    if (!pollRef.current) {
                        pollRef.current = setInterval(refreshMessages, 3000);
                    }
                    setTimeout(connect, 5000);
                    return;
                }
            }
            if (cancelled) return;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                if (pollRef.current) {
                    clearInterval(pollRef.current);
                    pollRef.current = null;
                }
                ws.send(
                    JSON.stringify({
                        subscribe: [`channel:${channelOid}`, 'all'],
                    }),
                );
                setIsConnected(true);
            };
            ws.onmessage = (event) => {
                let data: { event?: string; [k: string]: unknown };
                try {
                    data = JSON.parse(event.data);
                } catch {
                    return;
                }
                if (!data?.event) return;
                const evt = data.event;
                const inThisChannel = data.channel_oid === channelOid;

                if (evt === 'channel.message_posted' && inThisChannel) {
                    if (data.kind === 'agent_reply' && data.run_oid) {
                        patchActiveRuns(data.run_oid as string, null);
                    }
                    refreshMessages();
                } else if (
                    evt === 'channel.message_edited' ||
                    evt === 'channel.message_deleted' ||
                    evt === 'channel.message_pinned' ||
                    evt === 'channel.message_unpinned' ||
                    evt === 'channel.reaction_toggled'
                ) {
                    if (inThisChannel) refreshMessages();
                } else if (
                    evt === 'channel.member_added' ||
                    evt === 'channel.member_removed'
                ) {
                    if (inThisChannel) refreshMembers();
                } else if (evt === 'run.started' && data.run_oid) {
                    patchActiveRuns(data.run_oid as string, {});
                } else if (evt === 'run.progress' && data.run_oid) {
                    if (data.kind === 'thinking' && data.delta) {
                        patchActiveRuns(data.run_oid as string, {
                            thinking:
                                (activeRuns.get(data.run_oid as string)?.thinking ??
                                    '') + (data.delta as string),
                        });
                    } else if (data.kind === 'tool_call') {
                        patchActiveRuns(data.run_oid as string, {
                            last_tool: (data.tool as string) ?? null,
                            tool_phase: (data.phase as string) ?? null,
                        });
                    }
                } else if (
                    (evt === 'run.completed' ||
                        evt === 'run.failed' ||
                        evt === 'run.cancelled') &&
                    data.run_oid
                ) {
                    patchActiveRuns(data.run_oid as string, null);
                }
            };
            ws.onclose = () => {
                setIsConnected(false);
                if (!pollRef.current) {
                    pollRef.current = setInterval(refreshMessages, 3000);
                }
                setTimeout(connect, 5000);
            };
            ws.onerror = () => {
                ws.close();
            };
        }

        connect();

        return () => {
            cancelled = true;
            if (wsRef.current) wsRef.current.close();
            if (pollRef.current) clearInterval(pollRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelOid, refreshMessages, refreshMembers]);

    return { messages, members, isConnected, activeRuns, send };
}
