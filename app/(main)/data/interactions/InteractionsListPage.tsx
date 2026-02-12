'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MousePointerClick, RefreshCw, Search, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import { InfiniteLoadTrigger } from '@/components/data/InfiniteLoadTrigger';
import { formatDateTime } from '@/lib/utils/datetime';
import type { Interaction, InteractionListResponse } from '@/lib/types/objects';

const STATUS_STYLE: Record<'assigned' | 'deferred' | 'unassigned', { bg: string; text: string }> = {
    assigned: { bg: 'bg-green-500/20', text: 'text-green-500' },
    deferred: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
    unassigned: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
};

function getCreatedAtTimestamp(value: string): number {
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? 0 : ts;
}

export function InteractionsListPage() {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useRouter();
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');

    const {
        items: interactions,
        total: totalInteractions,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        reload,
    } = useInfiniteResource<Interaction, InteractionListResponse>('interactions', {
        pageSize: 1000,
        auto: true,
        query: {
            sort_by: 'created_at',
            order: 'desc',
        },
        extractItems: (response) => response.items,
        extractTotal: (response) => response.total,
        inferHasMore: (response, _pageItems, totalLoaded) => totalLoaded < response.total,
    });

    const sortedInteractions = useMemo(() => {
        return [...interactions].sort((a, b) => {
            const timeDelta = getCreatedAtTimestamp(b.created_at) - getCreatedAtTimestamp(a.created_at);
            if (timeDelta !== 0) return timeDelta;
            return b.oid.localeCompare(a.oid);
        });
    }, [interactions]);

    const filteredInteractions = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return sortedInteractions;

        return sortedInteractions.filter((interaction) => {
            return (
                interaction.stable_id.toLowerCase().includes(query) ||
                interaction.actor_stable_id.toLowerCase().includes(query) ||
                interaction.source_system.toLowerCase().includes(query) ||
                interaction.action_type.toLowerCase().includes(query) ||
                (interaction.content_text || '').toLowerCase().includes(query)
            );
        });
    }, [searchQuery, sortedInteractions]);

    const handleRefresh = () => {
        void reload();
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400'}`}>
                            <MousePointerClick className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Interactions</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {interactions.length.toLocaleString()} Active Loaded / {interactions.length.toLocaleString()} Loaded / {(totalInteractions ?? interactions.length).toLocaleString()} Total · Sorted by Created Time (Newest First)
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${(isInitialLoading || isLoadingMore) ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search interactions..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
                        />
                    </div>
                </div>

                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {isInitialLoading && interactions.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading interactions...</span>
                        </div>
                    ) : error && interactions.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredInteractions.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No interactions found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredInteractions.map((interaction) => {
                                const statusKey = (interaction.assignment_status || 'unassigned') as 'assigned' | 'deferred' | 'unassigned';
                                const statusStyle = STATUS_STYLE[statusKey];

                                return (
                                    <button
                                        key={interaction.oid}
                                        onClick={() => router.push(`/data/interactions/${interaction.oid}`)}
                                        className={`w-full text-left px-4 py-3 transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                    {interaction.content_text || '[No content text]'}
                                                </div>
                                                <div className={`text-sm truncate ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {interaction.stable_id} · {interaction.action_type} · {interaction.source_system} · {interaction.actor_stable_id}
                                                </div>
                                                <div className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {formatDateTime(interaction.created_at, timezone)}
                                                </div>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                                                {statusKey}
                                            </span>
                                        </div>
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
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading more interactions...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
