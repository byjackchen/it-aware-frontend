'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, RefreshCw, Search, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import { InfiniteLoadTrigger } from '@/components/data/InfiniteLoadTrigger';
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

    const {
        items: incidents,
        total: totalIncidents,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        reload,
    } = useInfiniteResource<Incident, IncidentListResponse>('incidents', {
        pageSize: 1000,
        auto: true,
        extractItems: (response) => response.items,
        extractTotal: (response) => response.total,
        inferHasMore: (response, _pageItems, totalLoaded) => totalLoaded < response.total,
    });

    const filteredIncidents = useMemo(() => {
        return incidents.filter((incident) => {
            return searchQuery === '' || incident.title.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [incidents, searchQuery]);

    const handleRefresh = () => {
        void reload();
    };

    const getPriorityStyle = (priority: string | null) => PRIORITY_COLORS[priority?.toLowerCase() || 'none'] || PRIORITY_COLORS.none;

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
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
                                {incidents.length.toLocaleString()} Active Loaded / {incidents.length.toLocaleString()} Loaded / {(totalIncidents ?? incidents.length).toLocaleString()} Total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${(isInitialLoading || isLoadingMore) ? 'animate-spin' : ''}`} />
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
                            placeholder="Search incidents..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-red-500/50`}
                        />
                    </div>
                </div>

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {isInitialLoading && incidents.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading incidents...</span>
                        </div>
                    ) : error && incidents.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredIncidents.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No incidents found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredIncidents.map((incident) => {
                                const style = getPriorityStyle(incident.priority);
                                return (
                                    <button
                                        key={incident.oid}
                                        onClick={() => router.push(`/data/incidents/${incident.oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
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
                            })}
                        </div>
                    )}
                </div>

                {hasMore && (
                    <InfiniteLoadTrigger
                        disabled={isInitialLoading || isLoadingMore}
                        onVisible={() => void loadMore()}
                    />
                )}

                {isLoadingMore && (
                    <div className={`py-4 text-center text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading more incidents...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
