'use client';

import { useMemo, useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { Route, RefreshCw, Search, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import { InfiniteLoadTrigger } from '@/components/data/InfiniteLoadTrigger';
import type { Scenario, ScenarioListResponse } from '@/lib/types/objects';

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
    onboarding: { bg: 'bg-cyan-500/20', text: 'text-cyan-500' },
};

export function ScenariosListPage() {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');

    const {
        items: scenarios,
        total: totalScenarios,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        reload,
    } = useInfiniteResource<Scenario, ScenarioListResponse>('scenarios', {
        pageSize: 300,
        auto: true,
        extractItems: (response) => response.items,
        extractTotal: (response) => response.total,
        inferHasMore: (response, _pageItems, totalLoaded) => totalLoaded < response.total,
    });

    const filteredScenarios = useMemo(() => {
        return scenarios.filter((scenario) => {
            return searchQuery === '' || scenario.scenario_type.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [scenarios, searchQuery]);

    const handleRefresh = () => {
        void reload();
    };

    const getTypeStyle = (type: string) => TYPE_COLORS[type.toLowerCase()] || { bg: 'bg-gray-500/20', text: 'text-gray-500' };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-cyan-100 text-cyan-600' : 'bg-cyan-500/20 text-cyan-400'}`}>
                            <Route className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Scenarios</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {scenarios.length.toLocaleString()} Loaded / {(totalScenarios ?? scenarios.length).toLocaleString()} Total
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
                            placeholder="Search scenario type..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-cyan-500/50`}
                        />
                    </div>
                </div>

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {isInitialLoading && scenarios.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading scenarios...</span>
                        </div>
                    ) : error && scenarios.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredScenarios.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No scenarios found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredScenarios.map((scenario) => {
                                const style = getTypeStyle(scenario.scenario_type);
                                return (
                                    <button
                                        key={scenario.oid}
                                        onClick={() => router.push(`/data/scenarios/${scenario.oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {scenario.scenario_type}
                                            </div>
                                            <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {scenario.worker_oid} • {new Date(scenario.effective_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${style.bg} ${style.text}`}>
                                            {scenario.scenario_type}
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
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading more scenarios...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
