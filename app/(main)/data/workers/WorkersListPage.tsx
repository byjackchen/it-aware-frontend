'use client';

/**
 * Workers list page client component.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, RefreshCw, Search, Check, X, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useLazyResourceList } from '@/lib/hooks/useLazyResourceList';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import { InfiniteLoadTrigger } from '@/components/data/InfiniteLoadTrigger';
import type { Worker, Organization } from '@/lib/types/objects';

export function WorkersListPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');
    const [workerTypeFilter, setWorkerTypeFilter] = useState<string | null>(null);

    const {
        items: workers,
        total: totalWorkers,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        reload,
    } = useInfiniteResource<Worker>('workers', {
        pageSize: 300,
        auto: true,
    });

    const { items: organizations } = useLazyResourceList<Organization>('organizations', {
        query: { limit: 1000 },
        auto: true,
    });

    const orgMap = useMemo(
        () => new Map(organizations.map((o) => [o.oid, o.name])),
        [organizations]
    );

    const workerTypes = useMemo(
        () => Array.from(new Set(workers.map(w => w.worker_type).filter(Boolean) as string[])).sort(),
        [workers]
    );

    const filteredWorkers = useMemo(() => {
        return workers.filter((w) => {
            const matchesSearch =
                searchQuery === '' ||
                w.fullname.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (w.email && w.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (w.worker_id && w.worker_id.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesType = workerTypeFilter === null || w.worker_type === workerTypeFilter;
            return matchesSearch && matchesType;
        });
    }, [workers, searchQuery, workerTypeFilter]);

    const handleRefresh = () => {
        void reload();
    };

    useEffect(() => {
        if (isInitialLoading || isLoadingMore || !hasMore) return;
        void loadMore();
    }, [hasMore, isInitialLoading, isLoadingMore, loadMore]);

    const totalLabel = useMemo(() => {
        if (typeof totalWorkers === 'number' && Number.isFinite(totalWorkers)) {
            return totalWorkers.toLocaleString();
        }
        if (hasMore) {
            return `${workers.length.toLocaleString()}+`;
        }
        return workers.length.toLocaleString();
    }, [hasMore, totalWorkers, workers.length]);

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
            `}>
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                Workers
                            </h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {workers.filter(w => w.is_active).length.toLocaleString()} Active Loaded / {workers.length.toLocaleString()} Loaded / {totalLabel} Total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}
                        >
                            <RefreshCw className={`w-5 h-5 ${(isInitialLoading || isLoadingMore) ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => router.push('/data/workers/new')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Worker</span>
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
                            placeholder="Search workers..."
                            className={`
                w-full pl-10 pr-4 py-2 rounded-lg
                ${isLight ? 'bg-slate-100 text-slate-800 placeholder-slate-400' : 'bg-white/10 text-white placeholder-gray-500'}
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
              `}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <select
                            value={workerTypeFilter || ''}
                            onChange={(e) => setWorkerTypeFilter(e.target.value || null)}
                            className={`px-3 py-2 text-sm rounded-lg border outline-none ${isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`}
                        >
                            <option value="">All Types</option>
                            {workerTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {isInitialLoading && workers.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading workers...
                            </span>
                        </div>
                    ) : error && workers.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredWorkers.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            No workers found
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredWorkers.map((worker) => (
                                <button
                                    key={worker.oid}
                                    onClick={() => router.push(`/data/workers/${worker.oid}`)}
                                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                      ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
                    `}>
                                            {worker.fullname.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {worker.fullname}
                                            </div>
                                            <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {worker.email || worker.worker_id || 'No email'}
                                                {' • '}
                                                {orgMap.get(worker.org_oid) || worker.org_oid}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {worker.is_active ? (
                                            <span className="flex items-center gap-1 text-xs text-green-500">
                                                <Check className="w-3 h-3" /> Active
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs text-red-500">
                                                <X className="w-3 h-3" /> Inactive
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
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
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading more workers...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
