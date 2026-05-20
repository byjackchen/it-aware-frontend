'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listChannels } from '@/lib/api/channels';
import type { Channel } from '@/lib/api/channels';

export function ChannelListSidebar() {
    const [data, setData] = useState<{ items: Channel[] } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function refresh() {
            try {
                const r = await listChannels({ is_active: true, limit: 100 });
                if (!cancelled) {
                    setData(r);
                    setError(null);
                }
            } catch (e: unknown) {
                if (!cancelled) setError(String((e as Error).message ?? e));
            }
        }
        refresh();
        const interval = setInterval(refresh, 8000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    if (error) {
        return (
            <p className="text-red-600 dark:text-red-300 text-sm p-3">
                Failed to load channels: {error}
            </p>
        );
    }
    if (!data) {
        return <p className="text-muted-foreground text-sm p-3">Loading…</p>;
    }

    return (
        <nav>
            <div className="flex justify-between items-center p-3 border-b">
                <h2 className="text-lg font-semibold">Channels</h2>
                <Link
                    href="/agent-ops/channels/new"
                    className="text-sm text-blue-600 dark:text-blue-300 hover:underline"
                >
                    + New
                </Link>
            </div>
            <ul className="divide-y">
                {data.items.length === 0 && (
                    <li className="p-3 text-sm text-muted-foreground">
                        No channels yet. Click + New.
                    </li>
                )}
                {data.items.map((c) => (
                    <li key={c.oid}>
                        <Link
                            href={`/agent-ops/channels/${c.oid}`}
                            className="block px-3 py-2 hover:bg-muted"
                        >
                            <div className="font-medium truncate">{c.name}</div>
                            {c.description && (
                                <div className="text-xs text-muted-foreground truncate">
                                    {c.description}
                                </div>
                            )}
                            {c.tags?.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    {c.tags.map((t) => `#${t}`).join(' ')}
                                </div>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </nav>
    );
}
