'use client';

/**
 * iOA Scans master worker list — mirrors the WorkersListPage pattern:
 * useInfiniteResource for paginated fetch, theme-aware styling, search +
 * filter row, RefreshCw button, and a clean list layout.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { Loader2, Network, RefreshCw, Search } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import type { WorkerWithLatestScan } from '@/lib/types/networks/ioa_scans';
import { ScanTriggerButton } from '@/components/ioa_scan/ScanTriggerButton';

type ScanFilter = 'all' | 'with_scan' | 'never';

function fmtNum(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString();
}
function fmtPct(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return `${(n * 100).toFixed(1)}%`;
}
function fmtRelative(iso: string | null | undefined): string {
    if (!iso) return 'never';
    const then = new Date(iso).getTime();
    const diffSec = Math.max(0, (Date.now() - then) / 1000);
    if (diffSec < 60) return `${Math.round(diffSec)}s ago`;
    if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
    return `${Math.round(diffSec / 86400)}d ago`;
}

export function IoaScanWorkersListPage() {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const isLight = theme === 'light';

    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<ScanFilter>('all');

    const {
        items: rows,
        total,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        reload,
    } = useInfiniteResource<WorkerWithLatestScan>('ioa-scan-workers', {
        pageSize: 200,
        auto: true,
    });

    // Auto-load all pages so search across the full dataset works.
    useEffect(() => {
        if (isInitialLoading || isLoadingMore || !hasMore) return;
        void loadMore();
    }, [hasMore, isInitialLoading, isLoadingMore, loadMore]);

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return rows.filter((r) => {
            const matchesSearch =
                q === '' ||
                r.worker_fullname.toLowerCase().includes(q) ||
                (r.worker_stable_id ?? '').toLowerCase().includes(q) ||
                (r.worker_email ?? '').toLowerCase().includes(q);
            const matchesFilter =
                filter === 'all' ||
                (filter === 'with_scan' && r.latest_scan != null) ||
                (filter === 'never' && r.latest_scan == null);
            return matchesSearch && matchesFilter;
        });
    }, [rows, searchQuery, filter]);

    const handleRefresh = () => {
        void reload();
    };

    const totalLabel = useMemo(() => {
        if (typeof total === 'number' && Number.isFinite(total)) {
            return total.toLocaleString();
        }
        if (hasMore) return `${rows.length.toLocaleString()}+`;
        return rows.length.toLocaleString();
    }, [hasMore, total, rows.length]);

    const withScanCount = useMemo(
        () => rows.filter((r) => r.latest_scan != null).length,
        [rows],
    );

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'
                            }`}
                        >
                            <Network className="w-5 h-5" />
                        </div>
                        <div>
                            <h1
                                className={`text-2xl font-semibold ${
                                    isLight ? 'text-slate-800' : 'text-white'
                                }`}
                            >
                                iOA Scans
                            </h1>
                            <p
                                className={`text-sm ${
                                    isLight ? 'text-slate-500' : 'text-gray-500'
                                }`}
                            >
                                {withScanCount.toLocaleString()} with scan / {rows.length.toLocaleString()} loaded / {totalLabel} total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className={`p-2 rounded-lg transition-colors ${
                                isLight
                                    ? 'text-slate-500 hover:bg-slate-100'
                                    : 'text-gray-400 hover:bg-white/10'
                            }`}
                            aria-label="Refresh"
                        >
                            <RefreshCw
                                className={`w-5 h-5 ${
                                    isInitialLoading || isLoadingMore ? 'animate-spin' : ''
                                }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search
                            className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                                isLight ? 'text-slate-400' : 'text-gray-500'
                            }`}
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, stable_id, email…"
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${
                                isLight
                                    ? 'bg-slate-100 text-slate-800 placeholder-slate-400'
                                    : 'bg-white/10 text-white placeholder-gray-500'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as ScanFilter)}
                            className={`px-3 py-2 text-sm rounded-lg border outline-none ${
                                isLight
                                    ? 'bg-white border-slate-200 text-slate-700'
                                    : 'bg-white/5 border-white/10 text-white'
                            }`}
                        >
                            <option value="all">All workers</option>
                            <option value="with_scan">With recent scan</option>
                            <option value="never">Never scanned</option>
                        </select>
                    </div>
                </div>

                {/* List */}
                <div
                    className={`rounded-xl border overflow-hidden ${
                        isLight
                            ? 'border-slate-200 bg-white'
                            : 'border-white/10 bg-white/5'
                    }`}
                >
                    {isInitialLoading && rows.length === 0 ? (
                        <div
                            className={`py-12 text-center ${
                                isLight ? 'text-slate-500' : 'text-gray-500'
                            }`}
                        >
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading workers…
                            </span>
                        </div>
                    ) : error && rows.length === 0 ? (
                        <div
                            className={`py-12 text-center ${
                                isLight ? 'text-red-500' : 'text-red-400'
                            }`}
                        >
                            {error}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div
                            className={`py-12 text-center ${
                                isLight ? 'text-slate-500' : 'text-gray-500'
                            }`}
                        >
                            No workers match the current filters
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filtered.map((row) => (
                                <Row
                                    key={row.worker_oid}
                                    row={row}
                                    isLight={isLight}
                                    onOpen={() =>
                                        router.push(`/persona/${encodeURIComponent(row.worker_oid)}`)
                                    }
                                />
                            ))}
                            {isLoadingMore && (
                                <div
                                    className={`py-3 text-center text-xs ${
                                        isLight ? 'text-slate-500' : 'text-gray-500'
                                    }`}
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <Loader2 className="w-3 h-3 animate-spin" /> Loading more…
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Row({
    row,
    isLight,
    onOpen,
}: {
    row: WorkerWithLatestScan;
    isLight: boolean;
    onOpen: () => void;
}) {
    const scan = row.latest_scan;
    const initials = row.worker_fullname
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    return (
        <div
            className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'
            }`}
        >
            <button
                onClick={onOpen}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
            >
                <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                        isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'
                    }`}
                >
                    {initials}
                </div>
                <div className="min-w-0">
                    <div
                        className={`font-medium truncate ${
                            isLight ? 'text-slate-800' : 'text-white'
                        }`}
                    >
                        {row.worker_fullname}
                    </div>
                    <div
                        className={`text-xs font-mono truncate ${
                            isLight ? 'text-slate-500' : 'text-gray-500'
                        }`}
                    >
                        {row.worker_stable_id ?? '—'}
                    </div>
                </div>
            </button>

            <div className="hidden sm:grid grid-cols-4 gap-6 text-sm shrink-0">
                <Cell
                    label="Last scan"
                    value={
                        scan ? (
                            <a
                                className={`hover:underline ${
                                    isLight ? 'text-slate-700' : 'text-slate-200'
                                }`}
                                href={`/data/networks/ioa-scans/${scan.oid}`}
                                onClick={(e) => e.stopPropagation()}
                                title={new Date(scan.scanned_at).toLocaleString()}
                            >
                                {fmtRelative(scan.scanned_at)}
                            </a>
                        ) : (
                            <span
                                className={`italic ${
                                    isLight ? 'text-slate-400' : 'text-gray-500'
                                }`}
                            >
                                never
                            </span>
                        )
                    }
                    isLight={isLight}
                />
                <Cell
                    label="Connections (24h)"
                    value={fmtNum(scan?.kpi_total_connections)}
                    isLight={isLight}
                    mono
                />
                <Cell
                    label="Failure rate"
                    value={fmtPct(scan?.kpi_failure_rate)}
                    isLight={isLight}
                    mono
                />
                <Cell
                    label="Devices"
                    value={fmtNum(scan?.device_count)}
                    isLight={isLight}
                    mono
                />
            </div>

            <div className="shrink-0">
                <ScanTriggerButton workerOid={row.worker_oid} />
            </div>
        </div>
    );
}

function Cell({
    label,
    value,
    isLight,
    mono = false,
}: {
    label: string;
    value: React.ReactNode;
    isLight: boolean;
    mono?: boolean;
}) {
    return (
        <div className="text-right min-w-[6rem]">
            <div
                className={`text-[10px] uppercase tracking-wide ${
                    isLight ? 'text-slate-400' : 'text-gray-500'
                }`}
            >
                {label}
            </div>
            <div
                className={`${mono ? 'font-mono' : ''} ${
                    isLight ? 'text-slate-800' : 'text-slate-200'
                }`}
            >
                {value}
            </div>
        </div>
    );
}
