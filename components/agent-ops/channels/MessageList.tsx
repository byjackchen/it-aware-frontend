'use client';

import { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';
import type { ChannelMessage } from '@/lib/api/channels';

export function MessageList({ messages }: { messages: ChannelMessage[] }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.scrollTop = ref.current.scrollHeight;
        }
    }, [messages]);

    return (
        <div ref={ref} className="flex-1 overflow-y-auto p-3">
            {messages.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    No messages yet — start by @-mentioning an agent.
                </p>
            ) : (
                messages.map((m) => <MessageItem key={m.oid} message={m} />)
            )}
        </div>
    );
}
