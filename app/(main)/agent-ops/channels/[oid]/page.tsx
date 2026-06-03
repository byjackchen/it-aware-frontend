'use client';

import { use, useEffect, useState } from 'react';
import { ChannelListSidebar } from '@/components/agent-ops/channels/ChannelListSidebar';
import { ChannelView } from '@/components/agent-ops/channels/ChannelView';

export default function ChannelDetailPage({
    params,
}: {
    params: Promise<{ oid: string }>;
}) {
    const { oid } = use(params);
    const [accountOid, setAccountOid] = useState<string | undefined>(undefined);
    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => setAccountOid(d?.account_oid ?? d?.oid))
            .catch(() => undefined);
    }, []);
    return (
        <div className="flex h-full">
            <aside className="w-80 border-r overflow-y-auto bg-card hidden md:block">
                <ChannelListSidebar />
            </aside>
            <main className="flex-1 flex flex-col">
                <ChannelView channelOid={oid} currentAccountOid={accountOid} />
            </main>
        </div>
    );
}
