'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listMembers, listMessages, postMessage } from '@/lib/api/channels';
import type { ChannelMember, ChannelMessage } from '@/lib/api/channels';

/**
 * Channel realtime stream — WebSocket primary, polling fallback.
 *
 * Connects to /ws on the backend (same origin in dev via Next.js proxy or
 * BACKEND_DOMAIN-derived URL). Subscribes to `channel:<oid>`. On every
 * `channel.*` event for this channel, refreshes the relevant slice.
 *
 * On WS close, polls every 3 s until reconnected.
 */
export function useChannelStream(channelOid: string) {
    const [messages, setMessages] = useState<ChannelMessage[]>([]);
    const [members, setMembers] = useState<ChannelMember[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [thinking, setThinking] = useState<string[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refreshMessages = useCallback(async () => {
        try {
            const r = await listMessages(channelOid, { limit: 100 });
            setMessages(r.items);
        } catch {
            // ignore — next refresh will retry
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

    useEffect(() => {
        refreshMessages();
        refreshMembers();

        let cancelled = false;
        let wsUrl: string | null = null;

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
                try {
                    const data = JSON.parse(event.data);
                    if (!data?.event) return;
                    if (data.event === 'channel.message_posted' && data.channel_oid === channelOid) {
                        // Drop thinking indicator for this run if the agent_reply arrived.
                        if (data.kind === 'agent_reply' && data.run_oid) {
                            setThinking((t) => t.filter((r) => r !== data.run_oid));
                        }
                        refreshMessages();
                    } else if (
                        data.event === 'channel.member_added' &&
                        data.channel_oid === channelOid
                    ) {
                        refreshMembers();
                    } else if (
                        data.event === 'channel.member_removed' &&
                        data.channel_oid === channelOid
                    ) {
                        refreshMembers();
                    } else if (data.event === 'run.started' && data.run_oid) {
                        setThinking((t) => Array.from(new Set([...t, data.run_oid])));
                    } else if (
                        (data.event === 'run.completed' || data.event === 'run.failed') &&
                        data.run_oid
                    ) {
                        setThinking((t) => t.filter((r) => r !== data.run_oid));
                    }
                } catch {
                    // ignore
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
    }, [channelOid, refreshMessages, refreshMembers]);

    return { messages, members, isConnected, thinking, send };
}
