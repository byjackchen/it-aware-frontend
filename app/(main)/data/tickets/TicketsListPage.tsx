'use client';

/**
 * Tickets list page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ticket, Plus, RefreshCw, Search } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Ticket as TicketType, Organization, Worker } from '@/lib/types/objects';

interface TicketsListPageProps {
    tickets: TicketType[];
    organizations: Organization[];
    workers: Worker[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    open: { bg: 'bg-green-500/20', text: 'text-green-500' },
    in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
    pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
    closed: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
    resolved: { bg: 'bg-purple-500/20', text: 'text-purple-500' },
};

export function TicketsListPage({ tickets, organizations, workers }: TicketsListPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    const orgMap = new Map(organizations.map((o) => [o.oid, o.name]));
    const workerMap = new Map(workers.map((w) => [w.oid, w.full_name]));

    const statuses = Array.from(new Set(tickets.map((t) => t.status))).sort();

    const filteredTickets = tickets.filter((t) => {
        const matchesSearch = searchQuery === '' || t.title.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === null || t.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.refresh();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const getStatusStyle = (status: string) => STATUS_COLORS[status] || STATUS_COLORS.open;

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                            <Ticket className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Tickets</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {filteredTickets.length} of {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => router.push('/data/tickets/new')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors">
                            <Plus className="w-4 h-4" />
                            <span>New Ticket</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tickets..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setStatusFilter(null)} className={`px-3 py-1.5 text-sm rounded-md ${statusFilter === null ? 'bg-blue-500 text-white' : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'}`}>
                            All
                        </button>
                        {statuses.map((status) => (
                            <button key={status} onClick={() => setStatusFilter(status)} className={`px-3 py-1.5 text-sm rounded-md capitalize ${statusFilter === status ? 'bg-blue-500 text-white' : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'}`}>
                                {status.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {filteredTickets.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No tickets found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredTickets.map((ticket) => {
                                const style = getStatusStyle(ticket.status);
                                return (
                                    <button
                                        key={ticket.oid}
                                        onClick={() => router.push(`/data/tickets/${ticket.oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{ticket.title}</div>
                                            <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {workerMap.get(ticket.worker_oid) || 'Unknown'} • {orgMap.get(ticket.org_oid) || 'Unknown org'}
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${style.bg} ${style.text}`}>
                                            {ticket.status.replace(/_/g, ' ')}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
