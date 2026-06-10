'use client';

import { useEffect, useState } from 'react';
import { useChannelStream } from './useChannelStream';
import { ChannelHeader } from './ChannelHeader';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { MemberPanel } from './MemberPanel';
import { ThinkingPanel } from './ThinkingPanel';
import { EditChannelDialog } from './EditChannelDialog';
import { getChannel } from '@/lib/api/channels';
import type { Channel, ChannelMessage } from '@/lib/api/channels';
import { listTicketsForChannel } from '@/lib/api/tickets-channel';
import type { Ticket } from '@/lib/api/tickets-channel';

export function ChannelView({
    channelOid,
    currentAccountOid,
}: {
    channelOid: string;
    currentAccountOid?: string;
}) {
    const [channel, setChannel] = useState<Channel | undefined>(undefined);
    const [editingChannel, setEditingChannel] = useState(false);
    // Replaces the old `threadParent` modal flow — when set, the composer at
    // the bottom of the page sends with reply_to_message_oid attached.
    const [replyTarget, setReplyTarget] = useState<ChannelMessage | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function refresh() {
            try {
                const c = await getChannel(channelOid);
                if (!cancelled) setChannel(c);
            } catch {
                /* ignore */
            }
        }
        refresh();
        const id = setInterval(refresh, 10000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [channelOid]);

    const { messages, members, isConnected, activeRuns, send } = useChannelStream(
        channelOid,
    );
    const [sendError, setSendError] = useState<string | null>(null);
    const [unresolved, setUnresolved] = useState<string[]>([]);

    const [ticketsByMsg, setTicketsByMsg] = useState<Map<string, Ticket>>(
        () => new Map(),
    );
    useEffect(() => {
        let cancelled = false;
        async function refresh() {
            try {
                const r = await listTicketsForChannel(channelOid);
                if (cancelled) return;
                const m = new Map<string, Ticket>();
                for (const t of r.items) {
                    if (t.channel_message_oid) m.set(t.channel_message_oid, t);
                }
                setTicketsByMsg(m);
            } catch {
                /* ignore */
            }
        }
        refresh();
        const id = setInterval(refresh, 6000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [channelOid, messages.length]);

    // Clear the reply target if the target message disappears (delete/race).
    useEffect(() => {
        if (replyTarget && !messages.some((m) => m.oid === replyTarget.oid)) {
            setReplyTarget(null);
        }
    }, [messages, replyTarget]);

    async function onSend(body: string, replyToMessageOid?: string) {
        setSendError(null);
        setUnresolved([]);
        try {
            const unresolvedMentions = await send(body, replyToMessageOid);
            if (unresolvedMentions.length > 0) {
                setUnresolved(unresolvedMentions);
            }
        } catch (e: unknown) {
            setSendError(String((e as Error).message ?? e));
        }
    }

    const pinned = messages.filter((m) => m.pinned_at && !m.deleted_at);

    return (
        <>
            <ChannelHeader
                channel={channel}
                isConnected={isConnected}
                onEdit={() => setEditingChannel(true)}
            />
            {pinned.length > 0 && (
                <div className="border-b border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-xs px-3 py-1 text-amber-900 dark:text-amber-200">
                    <span className="font-semibold">📌 Pinned:</span>{' '}
                    {pinned.map((p, i) => (
                        <span key={p.oid}>
                            &ldquo;{p.body.slice(0, 60)}{p.body.length > 60 ? '…' : ''}&rdquo;
                            {i < pinned.length - 1 ? ', ' : ''}
                        </span>
                    ))}
                </div>
            )}
            <div className="flex-1 flex overflow-hidden">
                <section className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
                    <MessageList
                        messages={messages}
                        currentAccountOid={currentAccountOid}
                        onSetReplyTarget={setReplyTarget}
                        ticketsByMsg={ticketsByMsg}
                    />
                    {sendError && (
                        <p className="text-red-700 dark:text-red-300 text-sm px-3 py-1 bg-red-50 dark:bg-red-950 border-t border-red-200 dark:border-red-900">
                            {sendError}
                        </p>
                    )}
                    {unresolved.length > 0 && (
                        <p className="text-amber-800 dark:text-amber-300 text-sm px-3 py-1 bg-amber-50 dark:bg-amber-950 border-t border-amber-200 dark:border-amber-900">
                            Unknown @mentions (ignored):{' '}
                            {unresolved.map((u) => `@${u}`).join(', ')}
                        </p>
                    )}
                    <MessageComposer
                        onSend={onSend}
                        members={members}
                        replyTo={replyTarget}
                        onCancelReply={() => setReplyTarget(null)}
                    />
                </section>
                <aside className="w-64 border-l border-slate-300 dark:border-slate-700 p-3 overflow-y-auto bg-white dark:bg-slate-900 hidden lg:block">
                    <MemberPanel members={members} />
                </aside>
                <ThinkingPanel activeRuns={activeRuns} />
            </div>
            {editingChannel && channel && (
                <EditChannelDialog
                    channel={channel}
                    onClose={() => setEditingChannel(false)}
                    onSaved={(c) => setChannel(c)}
                />
            )}
        </>
    );
}
