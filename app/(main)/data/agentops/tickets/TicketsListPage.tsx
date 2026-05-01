'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { Ticket as TicketIcon, Plus, RefreshCw, Search, Loader2, X } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { useServerSearch } from '@/lib/hooks/useServerSearch';
import { Pagination } from '@/components/data/Pagination';
import { AgentStatusIndicator } from '@/components/agentops/AgentStatusIndicator';
import type { Ticket, TicketListResponse } from '@/lib/types/objects';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    backlog: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
    in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    blocked: { bg: 'bg-red-500/20', text: 'text-red-400' },
    done: { bg: 'bg-green-500/20', text: 'text-green-400' },
};

export function TicketsListPage() {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useTransitionRouter();
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [remotePage, setRemotePage] = useState<{ page: number; items: Ticket[] } | null>(null);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const {
        items: tickets,
        total: totalTickets,
        isInitialLoading,
        error,
        reload,
    } = useInfiniteResource<Ticket, TicketListResponse>('tickets', {
        pageSize: 500,
        auto: true,
        extractItems: (response) => response.items,
        extractTotal: (response) => response.total,
        inferHasMore: () => false,
    });

    const { searchResults, isSearching, searchError, searchByStableId, clearSearch } = useServerSearch<Ticket>('tickets');

    const isFiltering = searchQuery.trim().length > 0;

    const filteredTickets = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return tickets;
        return tickets.filter((ticket) => (
            ticket.title.toLowerCase().includes(query)
            || ticket.status.toLowerCase().includes(query)
            || (ticket.assignee_account_oid?.toLowerCase().includes(query) ?? false)
        ));
    }, [tickets, searchQuery]);

    const totalPages = Math.ceil(
        (isFiltering ? filteredTickets.length : (totalTickets ?? tickets.length)) / pageSize
    ) || 1;

    const localStartIdx = (currentPage - 1) * pageSize;
    const isLocalPage = isFiltering || localStartIdx < filteredTickets.length;

    const displayedTickets = useMemo(() => {
        if (isLocalPage) {
            return filteredTickets.slice(localStartIdx, localStartIdx + pageSize);
        }
        if (remotePage?.page === currentPage) {
            return remotePage.items;
        }
        return [];
    }, [filteredTickets, localStartIdx, isLocalPage, remotePage, currentPage, pageSize]);

    const fetchRemotePage = useCallback((page: number) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsPageLoading(true);
        const skip = (page - 1) * pageSize;
        fetch(`/api/objects/tickets?skip=${skip}&limit=${pageSize}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(res => res.json())
            .then((data: TicketListResponse) => {
                if (!controller.signal.aborted) {
                    setRemotePage({ page, items: data.items });
                    setIsPageLoading(false);
                }
            })
            .catch(e => {
                if (e instanceof DOMException && e.name === 'AbortError') return;
                setIsPageLoading(false);
            });
    }, [pageSize]);

    useEffect(() => {
        if (!isLocalPage && remotePage?.page !== currentPage && !isInitialLoading) {
            fetchRemotePage(currentPage);
        }
    }, [currentPage, isLocalPage, remotePage?.page, isInitialLoading, fetchRemotePage]);

    useEffect(() => { setCurrentPage(1); setRemotePage(null); }, [searchQuery, pageSize]);

    const handleRefresh = () => {
        setCurrentPage(1);
        setRemotePage(null);
        clearSearch();
        void reload();
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            void searchByStableId(searchQuery.trim());
        }
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        if (!value.trim()) clearSearch();
    };

    const getStatusStyle = (status: string) => STATUS_COLORS[status] || STATUS_COLORS.backlog;

    const renderTicketRow = (ticket: Ticket, highlighted = false) => {
        const statusStyle = getStatusStyle(ticket.status);
        return (
            <button
                key={ticket.oid}
                onClick={() => router.push(`/data/agentops/tickets/${ticket.oid}`)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${highlighted
                    ? (isLight ? 'bg-blue-50 hover:bg-blue-100' : 'bg-blue-500/10 hover:bg-blue-500/20')
                    : (isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5')
                }`}
            >
                <div className="flex-1 min-w-0 flex items-center gap-3">
                    <div className="min-w-0">
                        <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            {ticket.title}
                        </div>
                        <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            {ticket.assignee_account_oid
                                ? `Assignee: ${ticket.assignee_account_oid.slice(0, 8)}...`
                                : 'Unassigned'
                            }
                            {ticket.tags && ticket.tags.length > 0 && ` • ${ticket.tags.join(', ')}`}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                    {ticket.flagged && (
                        <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">Flagged</span>
                    )}
                    <AgentStatusIndicator agentStatus={ticket.agent_status} />
                    <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                        {ticket.status.replace('_', ' ')}
                    </span>
                    <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                        {formatDateTime(ticket.created_at, timezone)}
                    </span>
                </div>
            </button>
        );
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                            <TicketIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Tickets</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {tickets.length.toLocaleString()} cached / {(totalTickets ?? tickets.length).toLocaleString()} total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isInitialLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => router.push('/data/agentops/tickets/new')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors">
                            <Plus className="w-4 h-4" />
                            <span>New Ticket</span>
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Search by title, status, or assignee..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                        />
                    </div>
                </div>

                {/* Server search results */}
                {(searchResults.length > 0 || isSearching || searchError) && (
                    <div className={`mb-4 rounded-xl border overflow-hidden ${isLight ? 'border-blue-200 bg-blue-50/50' : 'border-blue-500/30 bg-blue-500/5'}`}>
                        <div className={`flex items-center justify-between px-4 py-2 ${isLight ? 'bg-blue-100/50' : 'bg-blue-500/10'}`}>
                            <span className={`text-xs font-medium ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>
                                Server Search Results
                            </span>
                            <button onClick={clearSearch} className={`p-1 rounded transition-colors ${isLight ? 'text-blue-500 hover:bg-blue-200' : 'text-blue-400 hover:bg-blue-500/20'}`}>
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        {isSearching && (
                            <div className={`py-4 text-center text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Searching server...</span>
                            </div>
                        )}
                        {searchError && (
                            <div className={`py-4 text-center text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{searchError}</div>
                        )}
                        {searchResults.length > 0 && (
                            <div className="divide-y divide-blue-100 dark:divide-blue-500/10">
                                {searchResults.map((ticket) => renderTicketRow(ticket, true))}
                            </div>
                        )}
                    </div>
                )}

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {(isInitialLoading && tickets.length === 0) || (isPageLoading && displayedTickets.length === 0) ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading tickets...</span>
                        </div>
                    ) : error && tickets.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : displayedTickets.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No tickets found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {displayedTickets.map((ticket) => renderTicketRow(ticket))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={isFiltering ? filteredTickets.length : (totalTickets ?? tickets.length)}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
