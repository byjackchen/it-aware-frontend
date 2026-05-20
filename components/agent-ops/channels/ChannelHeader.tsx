'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { archiveChannel } from '@/lib/api/channels';
import type { Channel } from '@/lib/api/channels';

export function ChannelHeader({
    channel,
    isConnected,
}: {
    channel?: Channel;
    isConnected: boolean;
}) {
    const router = useRouter();
    const [archiving, setArchiving] = useState(false);

    async function onArchive() {
        if (!channel) return;
        if (!confirm(`Archive channel "${channel.name}"?`)) return;
        setArchiving(true);
        try {
            await archiveChannel(channel.oid);
            router.push('/agent-ops/channels');
        } finally {
            setArchiving(false);
        }
    }

    return (
        <header className="border-b p-3 flex items-center justify-between">
            <div className="min-w-0">
                <h1 className="text-lg font-semibold truncate">
                    {channel?.name ?? '…'}
                </h1>
                {channel?.description && (
                    <p className="text-sm text-muted-foreground truncate">
                        {channel.description}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
                <span
                    className={`text-xs ${isConnected ? 'text-green-600' : 'text-amber-600'}`}
                    title={isConnected ? 'WebSocket live' : 'Polling fallback'}
                >
                    {isConnected ? '● live' : '○ polling'}
                </span>
                {channel?.tags?.map((t) => (
                    <span
                        key={t}
                        className="text-xs bg-muted px-2 py-1 rounded"
                    >
                        #{t}
                    </span>
                ))}
                {channel?.is_active && (
                    <button
                        onClick={onArchive}
                        disabled={archiving}
                        className="text-sm text-red-600 hover:underline disabled:opacity-50"
                    >
                        {archiving ? 'Archiving…' : 'Archive'}
                    </button>
                )}
            </div>
        </header>
    );
}
