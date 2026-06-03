'use client';

import { useMemo, useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { Plus, Calendar } from 'lucide-react';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime, formatLocalDateTime, localDateTimeToIso, formatTzBadge } from '@/lib/utils/datetime';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { Pagination } from '@/components/data/Pagination';
import { AgentStatusIndicator } from '@/components/agentops/AgentStatusIndicator';
import type { Ticket, TicketListResponse } from '@/lib/types/objects';

type StatusFilter = 'all' | 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'blocked', label: 'Blocked' },
    { key: 'done', label: 'Done' },
    { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    open: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
    in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    blocked: { bg: 'bg-red-500/20', text: 'text-red-400' },
    done: { bg: 'bg-green-500/20', text: 'text-green-400' },
    cancelled: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
};

function defaultFrom(tz: string): string {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return `${formatLocalDateTime(d, tz).slice(0, 10)}T00:00:00`;
}
function defaultTo(tz: string): string {
    return `${formatLocalDateTime(new Date(), tz).slice(0, 10)}T23:59:59`;
}

export function TicketListView() {
    const router = useTransitionRouter();
    const { timezone } = useTimezone();
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [dateFrom, setDateFrom] = useState(() => defaultFrom(timezone));
    const [dateTo, setDateTo] = useState(() => defaultTo(timezone));
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);

    const { items: tickets, isInitialLoading, error, reload } = useInfiniteResource<Ticket, TicketListResponse>(
        'tickets',
        {
            pageSize: 500,
            auto: true,
            extractItems: (r) => r.items,
            extractTotal: (r) => r.total,
            inferHasMore: () => false,
        }
    );

    const filteredTickets = useMemo(() => {
        let result = tickets;
        if (statusFilter !== 'all') {
            result = result.filter(t => t.status === statusFilter);
        }
        if (dateFrom) {
            result = result.filter(t => new Date(t.created_at) >= new Date(localDateTimeToIso(dateFrom, timezone)));
        }
        if (dateTo) {
            result = result.filter(t => new Date(t.created_at) <= new Date(localDateTimeToIso(dateTo, timezone)));
        }
        return result;
    }, [tickets, statusFilter, dateFrom, dateTo, timezone]);

    const totalPages = Math.ceil(filteredTickets.length / pageSize) || 1;
    const startIdx = (currentPage - 1) * pageSize;
    const displayedTickets = filteredTickets.slice(startIdx, startIdx + pageSize);

    const handleStatusChange = async (oid: string, status: string) => {
        await fetch(`/api/agentops/tickets/${oid}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        await reload();
    };

    const handleFilterChange = (filter: StatusFilter) => {
        setStatusFilter(filter);
        setCurrentPage(1);
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Tickets</h1>
                <button
                    onClick={() => router.push('/data/agentops/tickets/new')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-color)] text-white hover:opacity-90 transition-opacity text-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Ticket
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
                <div className="flex items-center gap-1 rounded-lg border border-[var(--card-border)] p-1">
                    {STATUS_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => handleFilterChange(tab.key)}
                            className={`px-3 py-1 rounded text-sm transition-colors ${
                                statusFilter === tab.key
                                    ? 'bg-[var(--accent-color)] text-white'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <Calendar className="w-3.5 h-3.5" />
                    <input
                        type="datetime-local"
                        step={1}
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                        className="px-2 py-1 rounded border border-[var(--card-border)] bg-transparent text-xs"
                    />
                    <span>to</span>
                    <input
                        type="datetime-local"
                        step={1}
                        value={dateTo}
                        onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                        className="px-2 py-1 rounded border border-[var(--card-border)] bg-transparent text-xs"
                    />
                    <span title="filter timezone">{formatTzBadge(timezone)}</span>
                    {(dateFrom || dateTo) && (
                        <button
                            onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
                            className="text-[var(--accent-color)] hover:underline text-xs"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-[var(--card-border)] overflow-hidden">
                {isInitialLoading && tickets.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text-secondary)]">Loading tickets...</div>
                ) : error && tickets.length === 0 ? (
                    <div className="py-12 text-center text-red-400">{error}</div>
                ) : displayedTickets.length === 0 ? (
                    <div className="py-12 text-center text-[var(--text-secondary)]">No tickets found</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--card-border)] bg-[var(--glass-bg)]">
                                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Title</th>
                                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Status</th>
                                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Agent</th>
                                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Assignee</th>
                                <th className="px-4 py-3 text-left font-medium text-[var(--text-secondary)]">Created</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--card-border)]">
                            {displayedTickets.map(ticket => {
                                const statusStyle = STATUS_COLORS[ticket.status] || STATUS_COLORS.open;
                                return (
                                    <tr
                                        key={ticket.oid}
                                        onClick={() => window.open(`/data/agentops/tickets/${ticket.oid}`, '_blank')}
                                        className="hover:bg-[var(--glass-bg)] cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3 font-medium">{ticket.title}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                                                    {ticket.status.replace('_', ' ')}
                                                </span>
                                                <select
                                                    value={ticket.status}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        void handleStatusChange(ticket.oid, e.target.value);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-xs bg-transparent border border-[var(--card-border)] rounded px-1 py-0.5 text-[var(--text-secondary)]"
                                                >
                                                    <option value="open">Open</option>
                                                    <option value="in_progress">In Progress</option>
                                                    <option value="blocked">Blocked</option>
                                                    <option value="done">Done</option>
                                                    <option value="cancelled">Cancelled</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <AgentStatusIndicator agentStatus={ticket.has_active_run ? 'running' : 'idle'} />
                                        </td>
                                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                                            {ticket.assignee_account_oid
                                                ? `${ticket.assignee_account_oid.slice(0, 8)}...`
                                                : 'Unassigned'
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                                            {formatDateTime(ticket.created_at, timezone)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredTickets.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            />
        </div>
    );
}
