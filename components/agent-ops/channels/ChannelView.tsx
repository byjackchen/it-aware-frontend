'use client';

import { useEffect, useState } from 'react';
import { useChannelStream } from './useChannelStream';
import { ChannelHeader } from './ChannelHeader';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { MemberPanel } from './MemberPanel';
import { ThinkingPanel } from './ThinkingPanel';
import { ThreadDialog } from './ThreadDialog';
import { EditChannelDialog } from './EditChannelDialog';
import { getChannel } from '@/lib/api/channels';
import type { Channel, ChannelMessage } from '@/lib/api/channels';

export function ChannelView({
    channelOid,
    currentAccountOid,
}: {
    channelOid: string;
    currentAccountOid?: string;
}) {
    const [channel, setChannel] = useState<Channel | undefined>(undefined);
    const [editingChannel, setEditingChannel] = useState(false);
    const [threadParent, setThreadParent] = useState<ChannelMessage | null>(null);

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

    async function onSend(body: string) {
        setSendError(null);
        setUnresolved([]);
        try {
            const unresolvedMentions = await send(body);
            if (unresolvedMentions.length > 0) {
                setUnresolved(unresolvedMentions);
            }
        } catch (e: unknown) {
            setSendError(String((e as Error).message ?? e));
        }
    }

    function onOpenThread(parentOid: string) {
        const m = messages.find((x) => x.oid === parentOid);
        if (m) setThreadParent(m);
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
                <div className="border-b bg-amber-50/40 dark:bg-amber-950/20 text-xs px-3 py-1 text-amber-900 dark:text-amber-200">
                    <span className="font-semibold">📌 Pinned:</span>{' '}
                    {pinned.map((p, i) => (
                        <button
                            key={p.oid}
                            onClick={() => onOpenThread(p.oid)}
                            className="ml-1 underline hover:text-amber-700 dark:hover:text-amber-100"
                        >
                            &ldquo;{p.body.slice(0, 60)}{p.body.length > 60 ? '…' : ''}&rdquo;
                            {i < pinned.length - 1 ? ',' : ''}
                        </button>
                    ))}
                </div>
            )}
            <div className="flex-1 flex overflow-hidden">
                <section className="flex-1 flex flex-col min-w-0">
                    <MessageList
                        messages={messages}
                        currentAccountOid={currentAccountOid}
                        onOpenThread={onOpenThread}
                    />
                    {sendError && (
                        <p className="text-red-600 dark:text-red-300 text-sm px-3 py-1 bg-red-50 dark:bg-red-950/30">
                            {sendError}
                        </p>
                    )}
                    {unresolved.length > 0 && (
                        <p className="text-amber-700 dark:text-amber-300 text-sm px-3 py-1 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200 dark:border-amber-900/60">
                            Unknown @mentions (ignored):{' '}
                            {unresolved.map((u) => `@${u}`).join(', ')}
                        </p>
                    )}
                    <MessageComposer onSend={onSend} members={members} />
                </section>
                <aside className="w-64 border-l p-3 overflow-y-auto bg-card hidden lg:block">
                    <MemberPanel members={members} />
                </aside>
                <ThinkingPanel activeRuns={activeRuns} />
            </div>
            {threadParent && (
                <ThreadDialog
                    channelOid={channelOid}
                    parent={threadParent}
                    currentAccountOid={currentAccountOid}
                    onClose={() => setThreadParent(null)}
                />
            )}
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
