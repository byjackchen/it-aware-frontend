'use client';

/**
 * AgentOps Runs — read-only list (client). Compact themed table mirroring the
 * prompts/tickets house style: theme-aware via useTheme() + CSS vars.
 */
import { PlayCircle } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { Run } from '@/lib/types/objects';

interface Props {
    initial: Run[];
    total?: number;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    queued: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
    claimed: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    running: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    succeeded: { bg: 'bg-green-500/20', text: 'text-green-400' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400' },
    cancelled: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
};

// IDs are shown in full (no truncation/masking) by request.
const idText = (v: string | null | undefined) => v || '—';

// "Time lap" a run spent: started→completed, or started→now while in-flight.
function fmtDuration(start?: string | null, end?: string | null): string {
    if (!start) return '—';
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const ms = e - s;
    if (!Number.isFinite(ms) || ms < 0) return '—';
    const sec = Math.floor(ms / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s2 = sec % 60;
    if (h) return `${h}h ${m}m ${s2}s`;
    if (m) return `${m}m ${s2}s`;
    return `${s2}s`;
}

const TERMINAL = new Set(['succeeded', 'completed', 'failed', 'cancelled']);

export function RunsListPage({ initial, total }: Props) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';

    const count = total ?? initial.length;

    const thClass = `px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] whitespace-nowrap`;
    const tdClass = `px-3 py-2 text-sm align-top whitespace-nowrap`;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className={`text-2xl font-semibold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        <PlayCircle className="w-6 h-6 text-purple-400" /> Runs
                    </h1>
                    <span className="text-sm text-[var(--text-secondary)]">{count.toLocaleString()} run{count === 1 ? '' : 's'}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                    Read-only view of agent dispatch executions. Each run is one execution of an agent against a ticket (or ad-hoc payload).
                </p>

                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--card-border)]">
                                    <th className={thClass}>Status</th>
                                    <th className={thClass}>Agent</th>
                                    <th className={thClass}>Ticket</th>
                                    <th className={thClass}>Conversation</th>
                                    <th className={thClass}>Attempt</th>
                                    <th className={thClass}>Failure</th>
                                    <th className={thClass}>Created</th>
                                    <th className={thClass}>Completed</th>
                                    <th className={thClass}>Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {initial.map((run) => {
                                    const sc = STATUS_COLORS[run.status] || STATUS_COLORS.queued;
                                    return (
                                        <tr key={run.oid} className={`border-b border-[var(--card-border)] ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                                            <td className={tdClass}>
                                                <span className={`text-xs px-2 py-1 rounded-full capitalize ${sc.bg} ${sc.text}`}>
                                                    {run.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className={`${tdClass} font-mono text-xs`}>{idText(run.agent_oid)}</td>
                                            <td className={`${tdClass} font-mono text-xs`}>
                                                {run.ticket_oid ? (
                                                    <Link href={`/data/agentops/tickets/${run.ticket_oid}`} className="text-[var(--accent-color)] hover:underline">
                                                        {idText(run.ticket_oid)}
                                                    </Link>
                                                ) : '—'}
                                            </td>
                                            <td className={`${tdClass} font-mono text-xs`}>{idText(run.conversation_id)}</td>
                                            <td className={tdClass}>{run.attempt}/{run.max_attempts}</td>
                                            <td className={`${tdClass} max-w-[220px] truncate whitespace-normal text-xs text-[var(--text-secondary)]`} title={run.failure_reason || ''}>
                                                {run.failure_reason || '—'}
                                            </td>
                                            <td className={`${tdClass} text-xs text-[var(--text-secondary)]`}>{formatDateTime(run.created_at, timezone)}</td>
                                            <td className={`${tdClass} text-xs text-[var(--text-secondary)]`}>{run.completed_at ? formatDateTime(run.completed_at, timezone) : '—'}</td>
                                            <td className={`${tdClass} text-xs tabular-nums ${TERMINAL.has(run.status) ? 'text-[var(--text-secondary)]' : 'text-blue-400'}`} title={TERMINAL.has(run.status) ? 'Total time' : 'Elapsed so far'}>
                                                {fmtDuration(run.started_at, run.completed_at)}{!TERMINAL.has(run.status) && run.started_at ? '…' : ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {initial.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-3 py-10 text-center text-sm text-[var(--text-secondary)]">No runs yet.</td>
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
