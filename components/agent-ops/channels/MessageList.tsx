'use client';

import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import type { ChannelMessage } from '@/lib/api/channels';

interface Props {
    messages: ChannelMessage[];
    currentAccountOid?: string;
    onOpenThread?: (parentOid: string) => void;
}

export function MessageList({
    messages,
    currentAccountOid,
    onOpenThread,
}: Props) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.scrollTop = ref.current.scrollHeight;
        }
    }, [messages]);

    // Hide replies inline — they live in the thread dialog.
    const topLevel = messages.filter((m) => !m.reply_to_message_oid);

    return (
        <div ref={ref} className="flex-1 overflow-y-auto p-3">
            {topLevel.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    No messages yet — start by @-mentioning an agent.
                </p>
            ) : (
                topLevel.map((m) => (
                    <MessageItem
                        key={m.oid}
                        message={m}
                        currentAccountOid={currentAccountOid}
                        onOpenThread={onOpenThread}
                    />
                ))
            )}
        </div>
    );
}
