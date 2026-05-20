'use client';

import { useEffect, useState } from 'react';
import { useChannelStream } from './useChannelStream';
import { ChannelHeader } from './ChannelHeader';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { MemberPanel } from './MemberPanel';
import { TypingIndicator } from './TypingIndicator';
import { getChannel } from '@/lib/api/channels';
import type { Channel } from '@/lib/api/channels';

export function ChannelView({ channelOid }: { channelOid: string }) {
    const [channel, setChannel] = useState<Channel | undefined>(undefined);
    useEffect(() => {
        let cancelled = false;
        getChannel(channelOid).then((c) => {
            if (!cancelled) setChannel(c);
        }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [channelOid]);
    const { messages, members, isConnected, thinking, send } = useChannelStream(channelOid);
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

    return (
        <>
            <ChannelHeader channel={channel} isConnected={isConnected} />
            <div className="flex-1 flex overflow-hidden">
                <section className="flex-1 flex flex-col">
                    <MessageList messages={messages} />
                    <TypingIndicator runOids={thinking} members={members} />
                    {sendError && (
                        <p className="text-red-600 text-sm px-3 py-1 bg-red-50">
                            {sendError}
                        </p>
                    )}
                    {unresolved.length > 0 && (
                        <p className="text-amber-700 text-sm px-3 py-1 bg-amber-50 border-t border-amber-200">
                            Unknown @mentions (ignored):{' '}
                            {unresolved.map((u) => `@${u}`).join(', ')}
                        </p>
                    )}
                    <MessageComposer onSend={onSend} members={members} />
                </section>
                <aside className="w-64 border-l p-3 overflow-y-auto bg-card hidden lg:block">
                    <MemberPanel members={members} />
                </aside>
            </div>
        </>
    );
}
