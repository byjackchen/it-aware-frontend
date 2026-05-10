'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { AlertCircle, Loader2, Download, Filter, X, ChevronDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { downloadDashboardXlsx } from '@/lib/api/exports';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { Pagination } from '@/components/data/Pagination';
import { IncidentRow, INCIDENT_GRID_COLS } from '@/components/ssc/IncidentRow';
import {
    INCIDENT_CATEGORIES,
    getIncidentCategoryLabel,
    type Incident,
    type IncidentListResponse,
    type IncidentCategory,
    type WorkerContext,
} from '@/lib/types/objects';

interface IncidentsPanelProps {
    dateFrom: string;
    dateTo: string;
    workerFilter?: string;
    alignedIncidentOid: string | null;
    onAlign: (incident: Incident) => void;
    workerMap: Record<string, WorkerContext>;
    catalogMap: Record<string, string>;
    onFocusInteractions: (interactionOids: string[]) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export function IncidentsPanel({
    dateFrom,
    dateTo,
    workerFilter,
    alignedIncidentOid,
    onAlign,
    workerMap,
    catalogMap,
    onFocusInteractions,
}: IncidentsPanelProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const t = useTranslations('SSCDashboard');
    const locale = useLocale();
    const [isDownloading, setIsDownloading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [remotePage, setRemotePage] = useState<{ page: number; items: Incident[] } | null>(null);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    // ai_category filter
    const [selectedCategories, setSelectedCategories] = useState<Set<IncidentCategory | 'NONE'>>(new Set());
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);

    // optimization_needs sort state
    const [optimizationSort, setOptimizationSort] = useState<SortDirection>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
                setShowCategoryDropdown(false);
            }
        }
        if (showCategoryDropdown) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [showCategoryDropdown]);

    const query = useMemo(() => ({
        ...(dateFrom ? { created_at_from: dateFrom } : {}),
        ...(dateTo ? { created_at_to: dateTo } : {}),
    }), [dateFrom, dateTo]);

    const {
        items: incidents,
        total: totalIncidents,
        isInitialLoading,
        error,
    } = useInfiniteResource<Incident, IncidentListResponse>('incidents', {
        pageSize: 500,
        auto: true,
        query,
        extractItems: (response) => response.items,
        extractTotal: (response) => response.total,
        inferHasMore: () => false,
    });

    // Client-side worker filter + ai_category filter + sort
    const filteredIncidents = useMemo(() => {
        let result = incidents;
        if (workerFilter) {
            const q = workerFilter.toLowerCase();
            result = result.filter((inc) => {
                // Phase 3: prefer actor_stable_id (always set when caller has
                // a stable identifier — workers, system, agent, or external);
                // fall back to workerMap lookup for legacy rows.
                const stableId = inc.actor_stable_id
                    ?? (inc.actor_oid ? workerMap[inc.actor_oid]?.stable_id : undefined);
                return stableId?.toLowerCase().includes(q);
            });
        }
        if (selectedCategories.size > 0) {
            result = result.filter((inc) => {
                const cat = inc.ai_category ?? 'NONE';
                return selectedCategories.has(cat as IncidentCategory | 'NONE');
            });
        }
        
        // Apply sorting by review_needs_optimization if active
        if (optimizationSort) {
            result = [...result].sort((a, b) => {
                const aVal = a.review_needs_optimization ? 1 : 0;
                const bVal = b.review_needs_optimization ? 1 : 0;
                return optimizationSort === 'desc' ? bVal - aVal : aVal - bVal;
            });
        }
        
        return result;
    }, [incidents, workerFilter, workerMap, selectedCategories, optimizationSort]);

    const hasCategoryFilter = selectedCategories.size > 0;
    const hasAnyFilter = !!workerFilter || hasCategoryFilter;

    const totalPages = Math.ceil((hasAnyFilter ? filteredIncidents.length : (totalIncidents ?? incidents.length)) / pageSize) || 1;
    const localStartIdx = (currentPage - 1) * pageSize;
    const isLocalPage = hasAnyFilter || localStartIdx < filteredIncidents.length;

    const displayedIncidents = useMemo(() => {
        if (isLocalPage) {
            return filteredIncidents.slice(localStartIdx, localStartIdx + pageSize);
        }
        if (remotePage?.page === currentPage) {
            return remotePage.items;
        }
        return [];
    }, [filteredIncidents, localStartIdx, isLocalPage, remotePage, currentPage, pageSize]);

    const fetchRemotePage = useCallback((page: number) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsPageLoading(true);

        const skip = (page - 1) * pageSize;
        const params = new URLSearchParams({ skip: String(skip), limit: String(pageSize) });
        if (dateFrom) params.set('created_at_from', dateFrom);
        if (dateTo) params.set('created_at_to', dateTo);

        fetch(`/api/objects/incidents?${params.toString()}`, {
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
    }, [pageSize, dateFrom, dateTo]);

    useEffect(() => {
        if (!isLocalPage && remotePage?.page !== currentPage && !isInitialLoading) {
            fetchRemotePage(currentPage);
        }
    }, [currentPage, isLocalPage, remotePage?.page, isInitialLoading, fetchRemotePage]);

    useEffect(() => { setCurrentPage(1); setRemotePage(null); }, [pageSize, workerFilter, selectedCategories]);

    // Overlay map for optimistic inline-edit updates
    const [overlay, setOverlay] = useState<Map<string, Incident>>(new Map());

    const handleRowChange = useCallback((updated: Incident) => {
        setOverlay(m => {
            const next = new Map(m);
            next.set(updated.oid, updated);
            return next;
        });
    }, []);

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            await downloadDashboardXlsx(
                'incidents',
                {
                    created_at_from: dateFrom,
                    created_at_to: dateTo,
                },
                `ssc_ticket_dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`,
            );
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Download failed');
        } finally {
            setIsDownloading(false);
        }
    };

    const columnHeaderClass = `text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-500'}`;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Panel Header */}
            <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
                <div className="flex items-center gap-2">
                    <AlertCircle className={`w-4 h-4 ${isLight ? 'text-red-600' : 'text-red-400'}`} />
                    <span className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        Incidents
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                        {(totalIncidents ?? incidents.length).toLocaleString()} records
                    </span>
                    <button
                        type="button"
                        onClick={() => void handleDownload()}
                        disabled={isDownloading}
                        title={t('buttons.downloadXlsx')}
                        className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                            isLight
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50'
                                : 'bg-white/10 text-gray-200 hover:bg-white/20 disabled:opacity-50'
                        }`}
                    >
                        {isDownloading ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <Download className="w-3 h-3" />
                        )}
                        {t('buttons.downloadXlsx')}
                    </button>
                </div>
            </div>

            {/* Category Filter */}
            <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${
                isLight ? 'bg-indigo-50/30 border-slate-200' : 'bg-indigo-950/10 border-white/10'
            }`}>
                <div className="flex items-center gap-1.5 relative" ref={categoryDropdownRef}>
                    <Filter className={`w-3 h-3 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                    <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                        {t('categoryFilter.label')}
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowCategoryDropdown(v => !v)}
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${
                            hasCategoryFilter
                                ? isLight
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : 'bg-indigo-500/10 border-indigo-400/40 text-indigo-300'
                                : isLight
                                    ? 'bg-white border-slate-200 text-slate-600'
                                    : 'bg-white/5 border-white/15 text-gray-300'
                        } transition-colors`}
                    >
                        {hasCategoryFilter ? t('categoryFilter.selectedCount', { count: selectedCategories.size }) : t('categoryFilter.allLabel')}
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    {hasCategoryFilter && (
                        <button type="button" onClick={() => setSelectedCategories(new Set())} className={`p-0.5 rounded ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-gray-500 hover:text-gray-300'}`}>
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    {showCategoryDropdown && (
                        <div className={`absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-lg py-1 min-w-[170px] max-h-[280px] overflow-y-auto ${
                            isLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/15'
                        }`}>
                            {/* NONE option for unclassified */}
                            <label className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                                <input
                                    type="checkbox"
                                    checked={selectedCategories.has('NONE')}
                                    onChange={() => {
                                        setSelectedCategories(prev => {
                                            const next = new Set(prev);
                                            if (next.has('NONE')) next.delete('NONE'); else next.add('NONE');
                                            return next;
                                        });
                                    }}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className={isLight ? 'text-slate-700' : 'text-gray-200'}>—</span>
                                <span className={`ml-auto text-[10px] ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>({t('categoryFilter.unclassified')})</span>
                            </label>
                            {INCIDENT_CATEGORIES.map(cat => (
                                <label key={cat} className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                                    <input
                                        type="checkbox"
                                        checked={selectedCategories.has(cat)}
                                        onChange={() => {
                                            setSelectedCategories(prev => {
                                                const next = new Set(prev);
                                                if (next.has(cat)) next.delete(cat); else next.add(cat);
                                                return next;
                                            });
                                        }}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className={isLight ? 'text-slate-700' : 'text-gray-200'}>{getIncidentCategoryLabel(cat, locale)}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Column Headers */}
            <div className={`grid ${INCIDENT_GRID_COLS} gap-1 px-3 py-1.5 border-b ${
                isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-white/3 border-white/10'
            }`}>
                <div className={columnHeaderClass}></div>
                <div className={columnHeaderClass}>{t('headers.time')}</div>
                <div className={columnHeaderClass}>{t('headers.ticketId')}</div>
                <div className={columnHeaderClass}>{t('headers.summary')}</div>
                <div className={columnHeaderClass}>{t('headers.category')}</div>
                <div className={columnHeaderClass}>{t('headers.user')}</div>
                <div className={columnHeaderClass}>AI Cat.</div>
                <div className={columnHeaderClass}>Review Cat.</div>
                <div className={columnHeaderClass}>{t('headers.preFaq')}</div>
                <div className={columnHeaderClass}>{t('headers.kb')}</div>
                <div className={columnHeaderClass}>{t('headers.csatScore')}</div>
                <div className={columnHeaderClass}>{t('headers.csatText')}</div>
                <div className={columnHeaderClass}>QA</div>
                <div className={`${columnHeaderClass} flex items-center justify-between`}>
                    <span>{t('headers.needsOptimization')}</span>
                    <button
                        type="button"
                        onClick={() => setOptimizationSort(opt => 
                            opt === null ? 'desc' : opt === 'desc' ? 'asc' : null
                        )}
                        className={`ml-1 p-0.5 rounded transition-colors ${
                            optimizationSort
                                ? isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-300'
                                : isLight ? 'text-slate-400 hover:text-slate-600' : 'text-gray-600 hover:text-gray-400'
                        }`}
                        title={optimizationSort === 'desc' ? 'Sort by needs optimization (high to low)' : optimizationSort === 'asc' ? 'Sort by needs optimization (low to high)' : 'Click to sort'}
                    >
                        {optimizationSort === 'desc' ? (
                            <ArrowDown className="w-3 h-3" />
                        ) : optimizationSort === 'asc' ? (
                            <ArrowUp className="w-3 h-3" />
                        ) : (
                            <div className="w-3 h-3" />
                        )}
                    </button>
                </div>
                <div className={columnHeaderClass}>{t('headers.optimizationNotes')}</div>
                <div className={columnHeaderClass}>{t('headers.completed')}</div>
            </div>

            {/* Scrollable Rows */}
            <div className="flex-1 overflow-y-auto">
                {(isInitialLoading && incidents.length === 0) || (isPageLoading && displayedIncidents.length === 0) ? (
                    <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading incidents...
                        </span>
                    </div>
                ) : error && incidents.length === 0 ? (
                    <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                ) : displayedIncidents.length === 0 ? (
                    <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        No incidents found
                    </div>
                ) : (
                    displayedIncidents.map((incident) => {
                        const effective = overlay.get(incident.oid) ?? incident;
                        const needsOptimization = effective.review_needs_optimization === true;
                        const rowHighlight = needsOptimization 
                            ? isLight ? 'bg-yellow-50/50' : 'bg-yellow-500/5 border-l-2 border-yellow-500/50'
                            : '';
                        
                        return (
                            <div key={effective.oid} className={rowHighlight}>
                                <IncidentRow
                                    incident={effective}
                                    worker={effective.actor_oid ? workerMap[effective.actor_oid] : undefined}
                                    catalogName={catalogMap[effective.service_catalog_oid ?? '']}
                                    isAligned={effective.oid === alignedIncidentOid}
                                    onAlign={() => onAlign(effective)}
                                    onFocusInteractions={onFocusInteractions}
                                    onChange={handleRowChange}
                                />
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            <div className={`border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={hasAnyFilter ? filteredIncidents.length : (totalIncidents ?? incidents.length)}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
