'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { AlertCircle, Loader2, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { downloadDashboardXlsx } from '@/lib/api/exports';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { Pagination } from '@/components/data/Pagination';
import { IncidentRow, INCIDENT_GRID_COLS } from '@/components/ssc/IncidentRow';
import type { Incident, IncidentListResponse, WorkerContext } from '@/lib/types/objects';

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
    const [isDownloading, setIsDownloading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [remotePage, setRemotePage] = useState<{ page: number; items: Incident[] } | null>(null);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

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

    // Client-side worker filter: match actor_oid → stable_id via workerMap
    const filteredIncidents = useMemo(() => {
        if (!workerFilter) return incidents;
        const q = workerFilter.toLowerCase();
        return incidents.filter((inc) => {
            const stableId = workerMap[inc.actor_oid]?.stable_id;
            return stableId?.toLowerCase().includes(q);
        });
    }, [incidents, workerFilter, workerMap]);

    const totalPages = Math.ceil((workerFilter ? filteredIncidents.length : (totalIncidents ?? incidents.length)) / pageSize) || 1;
    const localStartIdx = (currentPage - 1) * pageSize;
    const isLocalPage = workerFilter || localStartIdx < filteredIncidents.length;

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

    useEffect(() => { setCurrentPage(1); setRemotePage(null); }, [pageSize, workerFilter]);

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
                <div className={columnHeaderClass}>{t('headers.preFaq')}</div>
                <div className={columnHeaderClass}>{t('headers.kb')}</div>
                <div className={columnHeaderClass}>{t('headers.csatScore')}</div>
                <div className={columnHeaderClass}>{t('headers.csatText')}</div>
                <div className={columnHeaderClass}>{t('headers.needsOptimization')}</div>
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
                        return (
                            <IncidentRow
                                key={effective.oid}
                                incident={effective}
                                worker={workerMap[effective.actor_oid]}
                                catalogName={catalogMap[effective.service_catalog_oid ?? '']}
                                isAligned={effective.oid === alignedIncidentOid}
                                onAlign={() => onAlign(effective)}
                                onFocusInteractions={onFocusInteractions}
                                onChange={handleRowChange}
                            />
                        );
                    })
                )}
            </div>

            {/* Pagination */}
            <div className={`border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={workerFilter ? filteredIncidents.length : (totalIncidents ?? incidents.length)}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
