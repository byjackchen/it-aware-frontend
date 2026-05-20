'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { globalSearch, listChannels } from '@/lib/api/channels';
import type {
    Channel,
    ChannelMessage,
    GlobalSearchResponse,
} from '@/lib/api/channels';
import { formatRelative } from '@/lib/relative-time';

export function ChannelListSidebar() {
    const [data, setData] = useState<{ items: Channel[] } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [search, setSearch] = useState<GlobalSearchResponse | null>(null);

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

    useEffect(() => {
        const trimmed = q.trim();
        if (!trimmed) return;
        let cancelled = false;
        const id = setTimeout(async () => {
            try {
                const r = await globalSearch(trimmed, 10);
                if (!cancelled) setSearch(r);
            } catch {
                if (!cancelled) setSearch(null);
            }
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(id);
        };
    }, [q]);

    function onSearchChange(value: string) {
        setQ(value);
        if (!value.trim()) setSearch(null);
    }

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

    const groups: Channel[] = data.items.filter((c) => !c.is_dm);
    const dms: Channel[] = data.items.filter((c) => c.is_dm);

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
            <div className="p-2 border-b">
                <input
                    placeholder="Search channels + messages…"
                    value={q}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="w-full border rounded p-1.5 text-sm bg-background"
                />
            </div>

            {search ? (
                <SearchResults search={search} onClear={() => onSearchChange('')} />
            ) : (
                <>
                    <Section title="Channels" rows={groups} />
                    <Section title="Direct Messages" rows={dms} emptyHint="Open an agent profile to start a DM." />
                </>
            )}
        </nav>
    );
}

function Section({
    title,
    rows,
    emptyHint,
}: {
    title: string;
    rows: Channel[];
    emptyHint?: string;
}) {
    return (
        <div className="border-b">
            <div className="px-3 pt-3 pb-1 text-xs uppercase tracking-wide text-muted-foreground">
                {title}
            </div>
            <ul className="divide-y">
                {rows.length === 0 && (
                    <li className="p-3 text-sm text-muted-foreground">
                        {emptyHint ?? 'No channels yet.'}
                    </li>
                )}
                {rows.map((c) => (
                    <ChannelRow key={c.oid} channel={c} />
                ))}
            </ul>
        </div>
    );
}

function ChannelRow({ channel: c }: { channel: Channel }) {
    const unread = c.unread_count ?? 0;
    return (
        <li>
            <Link
                href={`/agent-ops/channels/${c.oid}`}
                className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-muted"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span
                            className={`font-medium truncate ${unread > 0 ? 'text-foreground' : 'text-muted-foreground'}`}
                        >
                            {c.is_dm ? '💬 ' : '#'}
                            {c.name}
                        </span>
                    </div>
                    {c.last_message_at && (
                        <div className="text-[11px] text-muted-foreground">
                            {formatRelative(c.last_message_at)}
                        </div>
                    )}
                </div>
                {unread > 0 && (
                    <span className="text-[10px] rounded-full bg-red-600 text-white px-1.5 py-0.5 min-w-[1.25rem] text-center">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </Link>
        </li>
    );
}

function SearchResults({
    search,
    onClear,
}: {
    search: GlobalSearchResponse;
    onClear: () => void;
}) {
    return (
        <div>
            <div className="flex justify-between items-center px-3 pt-3 pb-1 text-xs uppercase tracking-wide text-muted-foreground">
                <span>Search results ({search.total})</span>
                <button onClick={onClear} className="text-muted-foreground hover:text-foreground">
                    Clear
                </button>
            </div>
            {search.channels.length > 0 && (
                <ul className="divide-y border-t">
                    <li className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40">
                        Channels
                    </li>
                    {search.channels.map((c) => (
                        <ChannelRow key={c.oid} channel={c} />
                    ))}
                </ul>
            )}
            {search.messages.length > 0 && (
                <ul className="divide-y border-t">
                    <li className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40">
                        Messages
                    </li>
                    {search.messages.map((m: ChannelMessage) => (
                        <li key={m.oid}>
                            <Link
                                href={`/agent-ops/channels/${m.channel_oid}`}
                                className="block px-3 py-2 hover:bg-muted"
                            >
                                <div className="text-xs text-muted-foreground">
                                    {formatRelative(m.created_at)}
                                </div>
                                <div className="text-sm truncate">{m.body}</div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
            {search.total === 0 && (
                <p className="px-3 py-3 text-sm text-muted-foreground">
                    No matches.
                </p>
            )}
        </div>
    );
}
