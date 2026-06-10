'use client';

import { useEffect, useMemo, useRef } from 'react';
import { MessageItem } from './MessageItem';
import type { ChannelMessage } from '@/lib/api/channels';
import type { Ticket } from '@/lib/api/tickets-channel';

interface Props {
    messages: ChannelMessage[];
    currentAccountOid?: string;
    /** Set the composer's reply target — replaces the old modal-thread flow. */
    onSetReplyTarget?: (m: ChannelMessage | null) => void;
    ticketsByMsg?: Map<string, Ticket>;
}

export function MessageList({
    messages,
    currentAccountOid,
    onSetReplyTarget,
    ticketsByMsg,
}: Props) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.scrollTop = ref.current.scrollHeight;
        }
    }, [messages]);

    // Build an oid → message map so each item can render the parent preview
    // without re-scanning the list per row.
    const byOid = useMemo(() => {
        const m = new Map<string, ChannelMessage>();
        for (const x of messages) m.set(x.oid, x);
        return m;
    }, [messages]);

    return (
        <div ref={ref} className="flex-1 overflow-y-auto p-3 bg-white dark:bg-slate-900">
            {messages.length === 0 ? (
                <p className="text-slate-500 dark:text-slate-400 text-sm">
                    No messages yet — start by @-mentioning an agent.
                </p>
            ) : (
                messages.map((m) => (
                    <MessageItem
                        key={m.oid}
                        message={m}
                        repliedTo={
                            m.reply_to_message_oid
                                ? byOid.get(m.reply_to_message_oid)
                                : undefined
                        }
                        currentAccountOid={currentAccountOid}
                        onSetReplyTarget={onSetReplyTarget}
                        ticket={ticketsByMsg?.get(m.oid)}
                    />
                ))
            )}
        </div>
    );
}
