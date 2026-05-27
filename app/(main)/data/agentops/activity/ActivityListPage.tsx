'use client';

/**
 * AgentOps Activity Events — read-only feed (client). Compact themed table.
 * Loads the most-recent events on mount via the existing listActivityEvents
 * client (reuses lib/api/activity-events.ts).
 */
import { useEffect, useState } from 'react';
import { History, Loader2, RefreshCw } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { listActivityEvents, type ActivityEvent } from '@/lib/api/activity-events';

const short = (v: string | null | undefined, n = 8) => (v ? `${v.slice(0, n)}…` : '—');

function compactJson(details: Record<string, unknown> | null | undefined): string {
    if (!details || Object.keys(details).length === 0) return '—';
    try {
        return JSON.stringify(details);
    } catch {
        return '—';
    }
}

export function ActivityListPage() {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';

    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [total, setTotal] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listActivityEvents({ limit: 100 });
            setEvents(data.items);
            setTotal(data.total);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load activity events');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const count = total ?? events.length;

    const thClass = `px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] whitespace-nowrap`;
    const tdClass = `px-3 py-2 text-sm align-top`;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className={`text-2xl font-semibold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        <History className="w-6 h-6 text-purple-400" /> Activity Events
                    </h1>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-[var(--text-secondary)]">{count.toLocaleString()} event{count === 1 ? '' : 's'}</span>
                        <button
                            onClick={() => void load()}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}
                            aria-label="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                    Read-only feed of dispatcher (run.*), channel (channel.*), and ticket-pipeline events, most recent first.
                </p>

                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--card-border)]">
                                    <th className={thClass}>Action</th>
                                    <th className={thClass}>Actor</th>
                                    <th className={thClass}>Target</th>
                                    <th className={thClass}>Occurred</th>
                                    <th className={thClass}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((ev) => (
                                    <tr key={ev.oid} className={`border-b border-[var(--card-border)] ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                                        <td className={`${tdClass} whitespace-nowrap`}>
                                            <span className="text-xs font-mono px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">{ev.action}</span>
                                        </td>
                                        <td className={`${tdClass} text-xs whitespace-nowrap`}>
                                            <span className="text-[var(--text-secondary)]">{ev.actor_type || '—'}</span>
                                            <span className="font-mono ml-1">{short(ev.actor_oid)}</span>
                                        </td>
                                        <td className={`${tdClass} text-xs whitespace-nowrap`}>
                                            <span className="text-[var(--text-secondary)]">{ev.target_type || '—'}</span>
                                            <span className="font-mono ml-1">{short(ev.target_oid)}</span>
                                        </td>
                                        <td className={`${tdClass} text-xs text-[var(--text-secondary)] whitespace-nowrap`}>{formatDateTime(ev.occurred_at, timezone)}</td>
                                        <td className={`${tdClass} max-w-[360px]`}>
                                            <span className="block truncate font-mono text-[11px] text-[var(--text-secondary)]" title={compactJson(ev.details)}>
                                                {compactJson(ev.details).slice(0, 120)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && events.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-10 text-center text-sm text-[var(--text-secondary)]">
                                            {error || 'No activity events yet.'}
                                        </td>
                                    </tr>
                                )}
                                {loading && events.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-10 text-center text-sm text-[var(--text-secondary)]">
                                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading activity events…</span>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
