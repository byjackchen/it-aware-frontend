'use client';

import { use } from 'react';
import { ChannelListSidebar } from '@/components/agent-ops/channels/ChannelListSidebar';
import { ChannelView } from '@/components/agent-ops/channels/ChannelView';

export default function ChannelDetailPage({
    params,
}: {
    params: Promise<{ oid: string }>;
}) {
    const { oid } = use(params);
    return (
        <div className="flex h-full">
            <aside className="w-80 border-r overflow-y-auto bg-card hidden md:block">
                <ChannelListSidebar />
            </aside>
            <main className="flex-1 flex flex-col">
                <ChannelView channelOid={oid} />
            </main>
        </div>
    );
}
