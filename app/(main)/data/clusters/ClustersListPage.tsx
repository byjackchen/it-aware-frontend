'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Network, RefreshCw, Search, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import type {
    ClusterSummaryResponse,
    WorkerCluster,
    WorkerClusterListResponse,
    Worker,
} from '@/lib/types/objects';

const PAGE_SIZE = 1000;

const CLUSTER_COLORS: Record<number, string> = {
    [-1]: 'bg-slate-400',
    0: 'bg-indigo-500',
    1: 'bg-emerald-500',
    2: 'bg-amber-500',
    3: 'bg-rose-500',
    4: 'bg-cyan-500',
    5: 'bg-violet-500',
};

const CLUSTER_BADGE_STYLES: Record<number, { bg: string; text: string }> = {
    [-1]: { bg: 'bg-slate-500/20', text: 'text-slate-500' },
    0: { bg: 'bg-indigo-500/20', text: 'text-indigo-500' },
    1: { bg: 'bg-emerald-500/20', text: 'text-emerald-500' },
    2: { bg: 'bg-amber-500/20', text: 'text-amber-500' },
    3: { bg: 'bg-rose-500/20', text: 'text-rose-500' },
    4: { bg: 'bg-cyan-500/20', text: 'text-cyan-500' },
    5: { bg: 'bg-violet-500/20', text: 'text-violet-500' },
};

function getClusterColor(label: number): string {
    return CLUSTER_COLORS[label] || 'bg-slate-400';
}

function getClusterBadge(label: number): { bg: string; text: string } {
    return CLUSTER_BADGE_STYLES[label] || { bg: 'bg-slate-500/20', text: 'text-slate-500' };
}

interface WorkerListResponse {
    items: Worker[];
    total: number;
}

export function ClustersListPage() {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useRouter();
    const t = useTranslations('Data.clusters');
    const isLight = theme === 'light';

    const [summary, setSummary] = useState<ClusterSummaryResponse | null>(null);
    const [assignments, setAssignments] = useState<WorkerCluster[]>([]);
    const [totalAssignments, setTotalAssignments] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterClusterLabel, setFilterClusterLabel] = useState('');
    const [workerMap, setWorkerMap] = useState<Record<string, { name: string; stableId: string }>>({});

    // Fetch worker name map
    useEffect(() => {
        async function fetchWorkers() {
            try {
                const map: Record<string, { name: string; stableId: string }> = {};
                let skip = 0;
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    const res = await fetch(`/api/objects/workers?limit=${PAGE_SIZE}&skip=${skip}`);
                    if (!res.ok) break;
                    const data: WorkerListResponse = await res.json();
                    for (const w of data.items || []) {
                        map[w.oid] = { name: w.fullname, stableId: w.stable_id };
                    }
                    if (Object.keys(map).length >= data.total || (data.items?.length ?? 0) < PAGE_SIZE) break;
                    skip += PAGE_SIZE;
                }
                setWorkerMap(map);
            } catch { /* ignore */ }
        }
        void fetchWorkers();
    }, []);

    // Fetch summary
    useEffect(() => {
        async function fetchSummary() {
            try {
                const res = await fetch('/api/objects/worker-clusters/summary');
                if (!res.ok) return;
                const data: ClusterSummaryResponse = await res.json();
                setSummary(data);
            } catch { /* ignore */ }
        }
        void fetchSummary();
    }, []);

    // Fetch all assignments
    const fetchAllAssignments = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setAssignments([]);
        setTotalAssignments(null);

        try {
            const allItems: WorkerCluster[] = [];
            let skip = 0;
            let total = 0;

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const params = new URLSearchParams({ limit: String(PAGE_SIZE), skip: String(skip) });
                if (filterClusterLabel !== '') params.set('cluster_label', filterClusterLabel);
                const res = await fetch(`/api/objects/worker-clusters?${params}`);
                if (!res.ok) throw new Error('Failed to load clusters');
                const data: WorkerClusterListResponse = await res.json();
                total = data.total;
                allItems.push(...(data.items || []));
                setAssignments([...allItems]);
                setTotalAssignments(total);

                if (allItems.length >= total || (data.items?.length ?? 0) < PAGE_SIZE) {
                    break;
                }
                skip += PAGE_SIZE;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
        }
    }, [filterClusterLabel]);

    useEffect(() => {
        void fetchAllAssignments();
    }, [fetchAllAssignments]);

    const filteredAssignments = useMemo(() => {
        if (searchQuery === '') return assignments;
        const q = searchQuery.toLowerCase();
        return assignments.filter((a) => {
            const worker = workerMap[a.worker_oid];
            return (
                a.worker_oid.toLowerCase().includes(q) ||
                (worker?.name.toLowerCase().includes(q) ?? false) ||
                (worker?.stableId.toLowerCase().includes(q) ?? false) ||
                (a.cluster_name?.toLowerCase().includes(q) ?? false)
            );
        });
    }, [assignments, searchQuery, workerMap]);

    const labelClass = `text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`;

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400'}`}>
                            <Network className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('title')}</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {filteredAssignments.length.toLocaleString()} Shown / {assignments.length.toLocaleString()} Loaded
                                {totalAssignments !== null && ` / ${totalAssignments.toLocaleString()} Total`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => void fetchAllAssignments()} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Summary cards */}
                {summary && (
                    <div className="space-y-4 mb-6">
                        {/* Stats row */}
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                            <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                                <div className={labelClass}>{t('totalWorkers')}</div>
                                <div className={`text-2xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                    {summary.total_workers.toLocaleString()}
                                </div>
                            </div>
                            <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                                <div className={labelClass}>{t('nClusters')}</div>
                                <div className={`text-2xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                    {summary.n_clusters}
                                </div>
                            </div>
                            <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                                <div className={labelClass}>{t('noiseCount')}</div>
                                <div className={`text-2xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                    {summary.noise_count.toLocaleString()}
                                </div>
                            </div>
                            <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                                <div className={labelClass}>{t('lastComputed')}</div>
                                <div className={`text-sm font-medium mt-1 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                                    {summary.computed_at ? formatDateTime(summary.computed_at, timezone) : '—'}
                                </div>
                            </div>
                        </div>

                        {/* Per-cluster cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                            {summary.clusters.map((cluster) => (
                                <button
                                    key={cluster.cluster_label}
                                    onClick={() => router.push(`/data/clusters/${cluster.cluster_label}`)}
                                    className={`rounded-xl border p-4 text-left transition-colors ${
                                        isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-white/10 bg-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className={`w-3 h-3 rounded-full ${getClusterColor(cluster.cluster_label)}`} />
                                        <span className={`text-sm font-semibold truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                            {cluster.cluster_name || `Cluster ${cluster.cluster_label}`}
                                        </span>
                                    </div>
                                    <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                        {cluster.size.toLocaleString()} {t('workers')} ({cluster.percentage.toFixed(1)}%)
                                    </div>
                                    <div className={`mt-2 h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/10'}`}>
                                        <div
                                            className={`h-full rounded-full ${getClusterColor(cluster.cluster_label)}`}
                                            style={{ width: `${Math.min(cluster.percentage, 100)}%` }}
                                        />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('searchPlaceholder')}
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
                        />
                    </div>
                    <select
                        value={filterClusterLabel}
                        onChange={(e) => setFilterClusterLabel(e.target.value)}
                        className={`px-3 py-2 rounded-lg text-sm ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
                    >
                        <option value="">{t('allClusters')}</option>
                        {summary?.clusters.map((c) => (
                            <option key={c.cluster_label} value={c.cluster_label}>
                                {c.cluster_name || `Cluster ${c.cluster_label}`} ({c.size})
                            </option>
                        ))}
                        <option value="-1">{t('noise')}</option>
                    </select>
                </div>

                {/* Loading progress */}
                {isLoading && assignments.length > 0 && (
                    <div className={`mb-4 text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading... {assignments.length.toLocaleString()}{totalAssignments !== null && ` / ${totalAssignments.toLocaleString()}`}
                        </span>
                    </div>
                )}

                {/* Worker assignments list */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {isLoading && assignments.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading clusters...</span>
                        </div>
                    ) : error && assignments.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredAssignments.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('empty')}</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredAssignments.map((a) => {
                                const worker = workerMap[a.worker_oid];
                                const badge = getClusterBadge(a.cluster_label);
                                return (
                                    <button
                                        key={a.worker_oid}
                                        onClick={() => router.push(`/persona/${a.worker_oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {worker?.name || a.worker_oid}
                                            </div>
                                            <div className={`text-sm truncate ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {worker?.stableId || ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4 shrink-0">
                                            <span className={`text-xs px-2 py-1 rounded-full ${badge.bg} ${badge.text}`}>
                                                {a.cluster_label === -1
                                                    ? t('noiseCount')
                                                    : (a.cluster_name || `Cluster ${a.cluster_label}`)}
                                            </span>
                                            <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                {(a.cluster_probability * 100).toFixed(0)}%
                                            </span>
                                        </div>
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
