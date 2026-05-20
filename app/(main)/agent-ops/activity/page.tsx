'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    listActivityEvents,
    type ActivityEvent,
} from '@/lib/api/activity-events';
import { formatRelative } from '@/lib/relative-time';

const ACTION_PREFIXES = ['', 'run.', 'channel.', 'ticket.'] as const;
const ACTOR_TYPES = ['', 'account', 'agent', 'system'] as const;
const TARGET_TYPES = ['', 'run', 'channel', 'ticket', 'message'] as const;

const ACTION_BADGE: Record<string, string> = {
    'run.started': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
    'run.completed': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200',
    'run.failed': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
    'run.cancelled': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
};
function badgeClass(action: string): string {
    return ACTION_BADGE[action] ?? 'bg-muted text-foreground';
}

const ACTOR_ICON: Record<string, string> = {
    account: '👤',
    agent: '🤖',
    system: '⚙️',
};

export default function ActivityEventsPage() {
    const [items, setItems] = useState<ActivityEvent[]>([]);
    const [total, setTotal] = useState(0);
    const [actionPrefix, setActionPrefix] = useState<string>('');
    const [actorType, setActorType] = useState<string>('');
    const [targetType, setTargetType] = useState<string>('');
    const [limit, setLimit] = useState(50);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function refresh() {
            if (paused) return;
            try {
                const r = await listActivityEvents({
                    action_prefix: actionPrefix || undefined,
                    actor_type: actorType || undefined,
                    target_type: targetType || undefined,
                    limit,
                });
                if (cancelled) return;
                setItems(r.items);
                setTotal(r.total);
                setError(null);
            } catch (e: unknown) {
                if (!cancelled) setError(String((e as Error).message ?? e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        refresh();
        const id = setInterval(refresh, 5000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [actionPrefix, actorType, targetType, limit, paused]);

    const grouped = useMemo(() => {
        const byDay: Record<string, ActivityEvent[]> = {};
        for (const e of items) {
            const day = e.occurred_at.slice(0, 10);
            (byDay[day] ??= []).push(e);
        }
        return Object.entries(byDay).sort((a, b) => (a[0] > b[0] ? -1 : 1));
    }, [items]);

    function toggleExpand(oid: string) {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(oid)) next.delete(oid);
            else next.add(oid);
            return next;
        });
    }

    return (
        <div className="flex h-full flex-col">
            <header className="border-b p-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h1 className="text-xl font-semibold">Activity Events</h1>
                    <p className="text-xs text-muted-foreground">
                        Append-only audit feed for runs, channels, and tickets.
                        Showing {items.length} of {total}.
                    </p>
                </div>
                <button
                    onClick={() => setPaused((p) => !p)}
                    className="text-xs px-2 py-1 rounded border hover:bg-muted"
                    title="Pause auto-refresh"
                >
                    {paused ? '▶ Resume live' : '⏸ Pause live'}
                </button>
            </header>

            <div className="border-b p-3 flex flex-wrap gap-3 items-center text-sm">
                <FilterSelect
                    label="Action"
                    value={actionPrefix}
                    options={ACTION_PREFIXES}
                    onChange={setActionPrefix}
                />
                <FilterSelect
                    label="Actor"
                    value={actorType}
                    options={ACTOR_TYPES}
                    onChange={setActorType}
                />
                <FilterSelect
                    label="Target"
                    value={targetType}
                    options={TARGET_TYPES}
                    onChange={setTargetType}
                />
                <FilterSelect
                    label="Limit"
                    value={String(limit)}
                    options={['25', '50', '100', '200']}
                    onChange={(v) => setLimit(Number(v))}
                />
                {(actionPrefix || actorType || targetType) && (
                    <button
                        onClick={() => {
                            setActionPrefix('');
                            setActorType('');
                            setTargetType('');
                        }}
                        className="text-xs px-2 py-1 rounded border hover:bg-muted"
                    >
                        Clear
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto">
                {error && (
                    <p className="m-3 text-red-600 dark:text-red-300 text-sm">
                        {error}
                    </p>
                )}
                {loading && items.length === 0 && (
                    <p className="m-3 text-muted-foreground text-sm">Loading…</p>
                )}
                {!loading && items.length === 0 && (
                    <p className="m-3 text-muted-foreground text-sm">
                        No events match these filters.
                    </p>
                )}
                {grouped.map(([day, rows]) => (
                    <section key={day}>
                        <div className="sticky top-0 z-10 bg-card border-b px-3 py-1 text-xs uppercase tracking-wide text-muted-foreground">
                            {day}
                        </div>
                        <ul>
                            {rows.map((e) => (
                                <li
                                    key={e.oid}
                                    className="border-b px-3 py-2 hover:bg-muted/40"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-lg leading-none mt-0.5">
                                            {ACTOR_ICON[e.actor_type ?? ''] ?? '•'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span
                                                    className={`text-xs font-mono rounded px-2 py-0.5 ${badgeClass(e.action)}`}
                                                >
                                                    {e.action}
                                                </span>
                                                <span
                                                    className="text-xs text-muted-foreground"
                                                    title={new Date(e.occurred_at).toLocaleString()}
                                                >
                                                    {formatRelative(e.occurred_at)}
                                                </span>
                                                {e.target_type && (
                                                    <span className="text-xs text-muted-foreground">
                                                        →{' '}
                                                        <span className="font-mono">
                                                            {e.target_type}
                                                        </span>
                                                        {e.target_oid && (
                                                            <span className="font-mono text-muted-foreground/70">
                                                                {' '}
                                                                {e.target_oid.slice(0, 12)}…
                                                            </span>
                                                        )}
                                                    </span>
                                                )}
                                                {e.workspace_id && (
                                                    <span className="text-xs text-muted-foreground">
                                                        · ws {e.workspace_id}
                                                    </span>
                                                )}
                                                {typeof e.details?.channel_oid === 'string' && (
                                                    <a
                                                        href={`/agent-ops/channels/${String(e.details.channel_oid)}`}
                                                        className="text-xs text-blue-600 dark:text-blue-300 hover:underline"
                                                    >
                                                        ↗ open channel
                                                    </a>
                                                )}
                                                {typeof e.details?.ticket_oid === 'string' && (
                                                    <a
                                                        href={`/agent-ops/ticket-list?focus=${String(e.details.ticket_oid)}`}
                                                        className="text-xs text-blue-600 dark:text-blue-300 hover:underline"
                                                    >
                                                        ↗ open ticket
                                                    </a>
                                                )}
                                            </div>
                                            {e.details &&
                                                Object.keys(e.details).length > 0 && (
                                                    <button
                                                        onClick={() => toggleExpand(e.oid)}
                                                        className="mt-1 text-xs text-blue-600 dark:text-blue-300 hover:underline"
                                                    >
                                                        {expanded.has(e.oid)
                                                            ? '▾ details'
                                                            : '▸ details'}
                                                    </button>
                                                )}
                                            {expanded.has(e.oid) && e.details && (
                                                <pre className="mt-1 text-xs bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                                                    {JSON.stringify(e.details, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
            </div>
        </div>
    );
}

function FilterSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: readonly string[];
    onChange: (v: string) => void;
}) {
    return (
        <label className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">{label}:</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="border rounded p-1 bg-background"
            >
                {options.map((o) => (
                    <option key={o} value={o}>
                        {o || 'all'}
                    </option>
                ))}
            </select>
        </label>
    );
}
