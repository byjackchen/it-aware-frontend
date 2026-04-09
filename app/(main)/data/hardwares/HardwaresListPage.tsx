'use client';

/**
 * Hardwares list page client component.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    HardDrive,
    RefreshCw,
    Search,
    Check,
    X,
    Loader2,
    Laptop,
    Monitor,
    Smartphone,
    Box,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import { InfiniteLoadTrigger } from '@/components/data/InfiniteLoadTrigger';
import type { Hardware } from '@/lib/types/objects';

function getHardwareIcon(modelCategory: string | null) {
    const cat = (modelCategory ?? '').toLowerCase();
    if (cat.includes('laptop') || cat.includes('notebook') || cat.includes('macbook')) return Laptop;
    if (cat.includes('monitor') || cat.includes('display') || cat.includes('screen')) return Monitor;
    if (cat.includes('phone') || cat.includes('mobile') || cat.includes('iphone')) return Smartphone;
    return Box;
}

function getStatusColor(status: string | null): string {
    switch (status) {
        case 'In use':
            return 'bg-green-500/10 text-green-500 border-green-500/20';
        case 'Retired':
            return 'bg-red-500/10 text-red-500 border-red-500/20';
        default:
            return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
}

export function HardwaresListPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');
    const [modelCategoryFilter, setModelCategoryFilter] = useState<string | null>(null);
    const [assetStatusFilter, setAssetStatusFilter] = useState<string | null>(null);
    const [regionFilter, setRegionFilter] = useState<string | null>(null);
    const [showInactive, setShowInactive] = useState(false);

    const {
        items: hardwares,
        total: totalHardwares,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        reload,
    } = useInfiniteResource<Hardware>('hardwares', {
        pageSize: 50,
        auto: true,
        query: showInactive ? {} : { is_active: true },
    });

    const modelCategories = useMemo(
        () => Array.from(new Set(hardwares.map(h => h.model_category).filter(Boolean) as string[])).sort(),
        [hardwares]
    );

    const assetStatuses = useMemo(
        () => Array.from(new Set(hardwares.map(h => h.asset_status).filter(Boolean) as string[])).sort(),
        [hardwares]
    );

    const regions = useMemo(
        () => Array.from(new Set(hardwares.map(h => h.region).filter(Boolean) as string[])).sort(),
        [hardwares]
    );

    const filteredHardwares = useMemo(() => {
        return hardwares.filter((h) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                searchQuery === '' ||
                (h.serial_number && h.serial_number.toLowerCase().includes(q)) ||
                (h.asset_tag && h.asset_tag.toLowerCase().includes(q)) ||
                (h.assigned_to_display_name && h.assigned_to_display_name.toLowerCase().includes(q));

            const matchesCategory = modelCategoryFilter === null || h.model_category === modelCategoryFilter;
            const matchesStatus = assetStatusFilter === null || h.asset_status === assetStatusFilter;
            const matchesRegion = regionFilter === null || h.region === regionFilter;

            return matchesSearch && matchesCategory && matchesStatus && matchesRegion;
        });
    }, [hardwares, searchQuery, modelCategoryFilter, assetStatusFilter, regionFilter]);

    const handleRefresh = () => {
        void reload();
    };

    useEffect(() => {
        if (isInitialLoading || isLoadingMore || !hasMore) return;
        void loadMore();
    }, [hasMore, isInitialLoading, isLoadingMore, loadMore]);

    const totalLabel = useMemo(() => {
        if (typeof totalHardwares === 'number' && Number.isFinite(totalHardwares)) {
            return totalHardwares.toLocaleString();
        }
        if (hasMore) {
            return `${hardwares.length.toLocaleString()}+`;
        }
        return hardwares.length.toLocaleString();
    }, [hasMore, totalHardwares, hardwares.length]);

    const selectClass = `px-3 py-2 text-sm rounded-lg border outline-none ${isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`;

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
                            <HardDrive className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {t('hardwares.title')}
                            </h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {hardwares.filter(h => h.is_active).length.toLocaleString()} Active Loaded / {hardwares.length.toLocaleString()} Loaded / {totalLabel} Total
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
                            placeholder={t('hardwares.searchPlaceholder')}
                            className={`
                                w-full pl-10 pr-4 py-2 rounded-lg
                                ${isLight ? 'bg-slate-100 text-slate-800 placeholder-slate-400' : 'bg-white/10 text-white placeholder-gray-500'}
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                            `}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <select
                            value={modelCategoryFilter || ''}
                            onChange={(e) => setModelCategoryFilter(e.target.value || null)}
                            className={selectClass}
                        >
                            <option value="">{t('hardwares.filterModelCategory')}</option>
                            {modelCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <select
                            value={assetStatusFilter || ''}
                            onChange={(e) => setAssetStatusFilter(e.target.value || null)}
                            className={selectClass}
                        >
                            <option value="">{t('hardwares.filterAssetStatus')}</option>
                            {assetStatuses.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                        <select
                            value={regionFilter || ''}
                            onChange={(e) => setRegionFilter(e.target.value || null)}
                            className={selectClass}
                        >
                            <option value="">{t('hardwares.filterRegion')}</option>
                            {regions.map(region => (
                                <option key={region} value={region}>{region}</option>
                            ))}
                        </select>
                        <label className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer ${isLight ? 'text-slate-700' : 'text-white'}`}>
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="rounded"
                            />
                            {t('hardwares.showInactive')}
                        </label>
                    </div>
                </div>

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {isInitialLoading && hardwares.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading hardwares...
                            </span>
                        </div>
                    ) : error && hardwares.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredHardwares.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            {t('hardwares.empty')}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredHardwares.map((hw) => {
                                const Icon = getHardwareIcon(hw.model_category);
                                return (
                                    <button
                                        key={hw.oid}
                                        onClick={() => router.push(`/data/hardwares/${hw.oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`
                                                w-10 h-10 rounded-full flex items-center justify-center
                                                ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
                                            `}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                    {hw.serial_number}
                                                </div>
                                                <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {hw.model_display_name || hw.model_category || '—'}
                                                    {hw.asset_tag ? ` • ${hw.asset_tag}` : ''}
                                                    {' • '}
                                                    {hw.assigned_to_display_name || t('hardwares.unassigned')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {hw.asset_status && (
                                                <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(hw.asset_status)}`}>
                                                    {hw.asset_status}
                                                </span>
                                            )}
                                            {hw.is_active ? (
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
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading more hardwares...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
