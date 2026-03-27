'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw, Search, Loader2, X } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { useServerSearch } from '@/lib/hooks/useServerSearch';
import { Pagination } from '@/components/data/Pagination';
import type { Incident, IncidentListResponse } from '@/lib/types/objects';

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-500' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-500' },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
    low: { bg: 'bg-green-500/20', text: 'text-green-500' },
    none: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
};

export function IncidentsListPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [remotePage, setRemotePage] = useState<{ page: number; items: Incident[] } | null>(null);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const {
        items: incidents,
        total: totalIncidents,
        isInitialLoading,
        error,
        reload,
    } = useInfiniteResource<Incident, IncidentListResponse>('incidents', {
        pageSize: 500,
        auto: true,
        extractItems: (response) => response.items,
        extractTotal: (response) => response.total,
        inferHasMore: () => false,
    });

    const { searchResults, isSearching, searchError, searchByStableId, clearSearch } = useServerSearch<Incident>('incidents');

    const isFiltering = searchQuery.trim().length > 0;

    const filteredIncidents = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return incidents;
        return incidents.filter((incident) =>
            incident.title.toLowerCase().includes(query)
            || (incident.stable_id?.toLowerCase().includes(query) ?? false)
            || incident.state.toLowerCase().includes(query)
        );
    }, [incidents, searchQuery]);

    const totalPages = Math.ceil(
        (isFiltering ? filteredIncidents.length : (totalIncidents ?? incidents.length)) / pageSize
    ) || 1;

    const localStartIdx = (currentPage - 1) * pageSize;
    const isLocalPage = isFiltering || localStartIdx < filteredIncidents.length;

    const displayedIncidents = useMemo(() => {
        if (isLocalPage) {
            return filteredIncidents.slice(localStartIdx, localStartIdx + pageSize);
        }
        if (remotePage?.page === currentPage) {
            return remotePage.items;
        }
        return [];
    }, [filteredIncidents, localStartIdx, isLocalPage, remotePage, currentPage]);

    // Fetch remote page when navigating beyond loaded data
    const fetchRemotePage = useCallback((page: number) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsPageLoading(true);

        const skip = (page - 1) * pageSize;
        fetch(`/api/objects/incidents?skip=${skip}&limit=${pageSize}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(res => res.json())
            .then((data: IncidentListResponse) => {
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

    const getPriorityStyle = (priority: string | null) => PRIORITY_COLORS[priority?.toLowerCase() || 'none'] || PRIORITY_COLORS.none;

    const renderIncidentRow = (incident: Incident, highlighted = false) => {
        const style = getPriorityStyle(incident.priority);
        return (
            <button
                key={incident.oid}
                onClick={() => router.push(`/data/incidents/${incident.oid}`)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${highlighted
                    ? (isLight ? 'bg-blue-50 hover:bg-blue-100' : 'bg-blue-500/10 hover:bg-blue-500/20')
                    : (isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5')
                }`}
            >
                <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{incident.title}</div>
                    <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        {(incident.stable_id || '—')} • {incident.state}
                    </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${style.bg} ${style.text}`}>
                    {incident.priority || 'No Priority'}
                </span>
            </button>
        );
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400'}`}>
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Incidents</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {incidents.length.toLocaleString()} cached / {(totalIncidents ?? incidents.length).toLocaleString()} total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isInitialLoading ? 'animate-spin' : ''}`} />
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
                            placeholder="Search by title, ID, or state... (Enter for exact ID lookup)"
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-red-500/50`}
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
                                {searchResults.map((incident) => renderIncidentRow(incident, true))}
                            </div>
                        )}
                    </div>
                )}

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {(isInitialLoading && incidents.length === 0) || (isPageLoading && displayedIncidents.length === 0) ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading incidents...</span>
                        </div>
                    ) : error && incidents.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : displayedIncidents.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No incidents found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {displayedIncidents.map((incident) => renderIncidentRow(incident))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={isFiltering ? filteredIncidents.length : (totalIncidents ?? incidents.length)}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
