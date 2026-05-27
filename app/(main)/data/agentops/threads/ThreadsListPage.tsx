'use client';

/**
 * AgentOps Threads — read-only list (client). Compact themed table of thread
 * messages across tickets.
 */
import { MessagesSquare } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { ThreadMessage, ThreadMessageKind } from '@/lib/types/objects';

interface Props {
    initial: ThreadMessage[];
    total?: number;
}

const KIND_COLORS: Record<ThreadMessageKind, { bg: string; text: string; label: string }> = {
    human_comment: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Comment' },
    agent_reply: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Agent reply' },
    system_note: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'System note' },
};

// IDs shown in full (no truncation/masking) by request.
const short = (v: string | null | undefined) => v || '—';

export function ThreadsListPage({ initial, total }: Props) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';

    const count = total ?? initial.length;

    const thClass = `px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)] whitespace-nowrap`;
    const tdClass = `px-3 py-2 text-sm align-top`;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className={`text-2xl font-semibold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        <MessagesSquare className="w-6 h-6 text-purple-400" /> Threads
                    </h1>
                    <span className="text-sm text-[var(--text-secondary)]">{count.toLocaleString()} message{count === 1 ? '' : 's'}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                    Read-only view of ticket-conversation messages: human comments, agent replies, and system notes.
                </p>

                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[var(--card-border)]">
                                    <th className={thClass}>Kind</th>
                                    <th className={thClass}>Body</th>
                                    <th className={thClass}>Ticket</th>
                                    <th className={thClass}>Author / Run</th>
                                    <th className={thClass}>Created</th>
                                </tr>
                            </thead>
                            <tbody>
                                {initial.map((m) => {
                                    const kc = KIND_COLORS[m.kind];
                                    return (
                                        <tr key={m.oid} className={`border-b border-[var(--card-border)] ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                                            <td className={`${tdClass} whitespace-nowrap`}>
                                                <span className={`text-xs px-2 py-1 rounded-full ${kc.bg} ${kc.text}`}>{kc.label}</span>
                                            </td>
                                            <td className={`${tdClass} max-w-[420px]`}>
                                                <span className="block truncate" title={m.body}>{m.body.slice(0, 80)}{m.body.length > 80 ? '…' : ''}</span>
                                            </td>
                                            <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                                                <Link href={`/data/agentops/tickets/${m.ticket_oid}`} className="text-[var(--accent-color)] hover:underline">
                                                    {short(m.ticket_oid)}
                                                </Link>
                                            </td>
                                            <td className={`${tdClass} font-mono text-xs whitespace-nowrap`}>
                                                {m.kind === 'agent_reply'
                                                    ? `run ${short(m.run_oid)}`
                                                    : short(m.author_account_oid)}
                                            </td>
                                            <td className={`${tdClass} text-xs text-[var(--text-secondary)] whitespace-nowrap`}>{formatDateTime(m.created_at, timezone)}</td>
                                        </tr>
                                    );
                                })}
                                {initial.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-10 text-center text-sm text-[var(--text-secondary)]">No thread messages yet.</td>
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
