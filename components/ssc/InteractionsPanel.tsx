'use client';

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { MessageCircle, Loader2, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { downloadDashboardXlsx } from '@/lib/api/exports';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { Pagination } from '@/components/data/Pagination';
import { InteractionRow } from '@/components/ssc/InteractionRow';
import type {
    Interaction,
    InteractionListResponse,
    WorkerContext,
} from '@/lib/types/objects';

// ---------------------------------------------------------------------------
// Column template (shared between header + rows via InteractionRow)
// ---------------------------------------------------------------------------

const GRID_COLS =
    'grid-cols-[100px_90px_70px_70px_100px_1fr_1fr_80px_80px_60px_70px_70px_60px_140px_60px]';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InteractionsPanelProps {
    dateFrom: string;
    dateTo: string;
    workerFilter?: string;
    highlightWindow: { start: number; end: number } | null;
    highlightWorkerStableId: string | null;
    alignedRowOid: string | null;
    onItemsChange?: (items: Interaction[]) => void;
    workerMap: Record<string, WorkerContext>;
    focusedInteractionOids?: Set<string> | null;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function InteractionsPanel({
    dateFrom,
    dateTo,
    workerFilter,
    highlightWindow,
    highlightWorkerStableId,
    alignedRowOid,
    onItemsChange,
    workerMap,
    focusedInteractionOids,
}: InteractionsPanelProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const alignedRef = useRef<HTMLDivElement | null>(null);
    const firstFocusedRef = useRef<HTMLDivElement | null>(null);

    const t = useTranslations('SSCDashboard');
    const [isDownloading, setIsDownloading] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [remotePage, setRemotePage] = useState<{ page: number; items: Interaction[] } | null>(null);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    // Build a stable_id → WorkerContext lookup from workerMap (which is keyed by oid)
    const workerByStableId = useMemo<Record<string, WorkerContext>>(() => {
        const map: Record<string, WorkerContext> = {};
        for (const wc of Object.values(workerMap)) {
            if (wc.stable_id) map[wc.stable_id] = wc;
        }
        return map;
    }, [workerMap]);

    // Data loading — initial batch (first 500); later pages fetched on demand
    const query = useMemo(
        () => ({
            sort_by: 'created_at',
            order: 'desc' as const,
            ...(dateFrom ? { created_at_from: dateFrom } : {}),
            ...(dateTo ? { created_at_to: dateTo } : {}),
            ...(workerFilter ? { actor_stable_id: workerFilter } : {}),
        }),
        [dateFrom, dateTo, workerFilter],
    );

    const {
        items: interactions,
        total,
        isInitialLoading,
        error,
    } = useInfiniteResource<Interaction, InteractionListResponse>('interactions', {
        pageSize: 500,
        auto: true,
        query,
        extractItems: response => response.items,
        extractTotal: response => response.total,
        inferHasMore: () => false,
    });

    // Notify parent of loaded items for alignment search
    useEffect(() => {
        onItemsChange?.(interactions);
    }, [interactions, onItemsChange]);

    const totalCount = total ?? interactions.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const localStartIdx = (currentPage - 1) * pageSize;
    const isLocalPage = localStartIdx < interactions.length;

    const displayedInteractions = useMemo(() => {
        if (isLocalPage) {
            return interactions.slice(localStartIdx, localStartIdx + pageSize);
        }
        if (remotePage?.page === currentPage) {
            return remotePage.items;
        }
        return [];
    }, [interactions, localStartIdx, isLocalPage, remotePage, currentPage, pageSize]);

    // Remote page fetcher (for pages whose start index exceeds the loaded batch)
    const fetchRemotePage = useCallback(
        (page: number) => {
            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            setIsPageLoading(true);

            const skip = (page - 1) * pageSize;
            const params = new URLSearchParams({
                skip: String(skip),
                limit: String(pageSize),
                sort_by: 'created_at',
                order: 'desc',
            });
            if (dateFrom) params.set('created_at_from', dateFrom);
            if (dateTo) params.set('created_at_to', dateTo);
            if (workerFilter) params.set('actor_stable_id', workerFilter);

            fetch(`/api/objects/interactions?${params.toString()}`, {
                cache: 'no-store',
                signal: controller.signal,
            })
                .then(res => res.json())
                .then((data: InteractionListResponse) => {
                    if (!controller.signal.aborted) {
                        setRemotePage({ page, items: data.items });
                        setIsPageLoading(false);
                    }
                })
                .catch(e => {
                    if (e instanceof DOMException && e.name === 'AbortError') return;
                    setIsPageLoading(false);
                });
        },
        [pageSize, dateFrom, dateTo, workerFilter],
    );

    useEffect(() => {
        if (!isLocalPage && remotePage?.page !== currentPage && !isInitialLoading) {
            fetchRemotePage(currentPage);
        }
    }, [currentPage, isLocalPage, remotePage?.page, isInitialLoading, fetchRemotePage]);

    // Reset pagination when filters or pageSize change
    useEffect(() => {
        setCurrentPage(1);
        setRemotePage(null);
    }, [pageSize, dateFrom, dateTo, workerFilter]);

    // When alignedRowOid changes, switch to the page that contains it (if found in loaded data)
    useEffect(() => {
        if (!alignedRowOid) return;
        const idx = interactions.findIndex(i => i.oid === alignedRowOid);
        if (idx < 0) return;
        const targetPage = Math.floor(idx / pageSize) + 1;
        if (targetPage !== currentPage) {
            setCurrentPage(targetPage);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only react to alignedRowOid
    }, [alignedRowOid, interactions, pageSize]);

    // When focusedInteractionOids changes, switch to the page containing the first focused row
    useEffect(() => {
        if (!focusedInteractionOids || focusedInteractionOids.size === 0) return;
        const idx = interactions.findIndex(i => focusedInteractionOids.has(i.oid));
        if (idx < 0) return;
        const targetPage = Math.floor(idx / pageSize) + 1;
        if (targetPage !== currentPage) {
            setCurrentPage(targetPage);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only react to focusedInteractionOids
    }, [focusedInteractionOids, interactions, pageSize]);

    // Scroll to aligned row when it appears on the visible page
    useEffect(() => {
        if (alignedRowOid && alignedRef.current) {
            alignedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [alignedRowOid, currentPage, displayedInteractions]);

    // Scroll to first focused row when it appears on the visible page
    useEffect(() => {
        if (focusedInteractionOids && firstFocusedRef.current) {
            firstFocusedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [focusedInteractionOids, currentPage, displayedInteractions]);

    // Overlay map for optimistic inline-edit updates
    const [overlay, setOverlay] = useState<Map<string, Interaction>>(new Map());

    const handleRowChange = useCallback((updated: Interaction) => {
        setOverlay(m => {
            const next = new Map(m);
            next.set(updated.oid, updated);
            return next;
        });
    }, []);

    // Window highlight helper
    const isInWindow = (createdAt: string, actorStableId: string): boolean => {
        if (!highlightWindow) return false;
        if (highlightWorkerStableId && actorStableId !== highlightWorkerStableId) return false;
        const ts = new Date(createdAt).getTime();
        return ts >= highlightWindow.start && ts <= highlightWindow.end;
    };

    const handleDownload = async () => {
        setIsDownloading(true);
        try {
            await downloadDashboardXlsx(
                'interactions',
                {
                    created_at_from: dateFrom,
                    created_at_to: dateTo,
                    actor_stable_id: workerFilter,
                },
                `ssc_faq_dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
            <div
                className={`flex items-center justify-between px-4 py-2.5 border-b ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
                }`}
            >
                <div className="flex items-center gap-2">
                    <MessageCircle
                        className={`w-4 h-4 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}
                    />
                    <span
                        className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}
                    >
                        Interaction Dashboard
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                        {totalCount.toLocaleString()} records
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
            <div
                className={`grid ${GRID_COLS} gap-1 px-3 py-1.5 border-b ${
                    isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-white/3 border-white/10'
                }`}
            >
                <div className={columnHeaderClass}>{t('headers.time')}</div>
                <div className={columnHeaderClass}>{t('headers.user')}</div>
                <div className={columnHeaderClass}>{t('headers.region')}</div>
                <div className={columnHeaderClass}>{t('headers.country')}</div>
                <div className={columnHeaderClass}>{t('headers.department')}</div>
                <div className={columnHeaderClass}>{t('headers.question')}</div>
                <div className={columnHeaderClass}>{t('headers.faqReply')}</div>
                <div className={columnHeaderClass}>{t('headers.ciAi')}</div>
                <div className={columnHeaderClass}>{t('headers.ciReview')}</div>
                <div className={columnHeaderClass}>{t('headers.helpful')}</div>
                <div className={columnHeaderClass}>{t('headers.codeAi')}</div>
                <div className={columnHeaderClass}>{t('headers.codeReview')}</div>
                <div className={columnHeaderClass}>{t('headers.needsOptimization')}</div>
                <div className={columnHeaderClass}>{t('headers.optimizationNotes')}</div>
                <div className={columnHeaderClass}>{t('headers.completed')}</div>
            </div>

            {/* Scrollable Rows */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                {(isInitialLoading && interactions.length === 0) ||
                (isPageLoading && displayedInteractions.length === 0) ? (
                    <div
                        className={`py-12 text-center ${
                            isLight ? 'text-slate-500' : 'text-gray-500'
                        }`}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading interactions...
                        </span>
                    </div>
                ) : error && interactions.length === 0 ? (
                    <div
                        className={`py-12 text-center ${
                            isLight ? 'text-red-500' : 'text-red-400'
                        }`}
                    >
                        {error}
                    </div>
                ) : displayedInteractions.length === 0 ? (
                    <div
                        className={`py-12 text-center ${
                            isLight ? 'text-slate-500' : 'text-gray-500'
                        }`}
                    >
                        No chatbot interactions found
                    </div>
                ) : (
                    (() => {
                        let firstFocusedAssigned = false;
                        return displayedInteractions.map(interaction => {
                            const effective = overlay.get(interaction.oid) ?? interaction;
                            const inWindow = isInWindow(
                                effective.created_at,
                                effective.actor_stable_id,
                            );
                            const isAligned = effective.oid === alignedRowOid;
                            const isFocused =
                                focusedInteractionOids?.has(effective.oid) ?? false;

                            // Assign ref to the first focused row for scroll
                            let thisRowRef: React.RefObject<HTMLDivElement | null> | undefined;
                            if (isFocused && !firstFocusedAssigned) {
                                firstFocusedAssigned = true;
                                thisRowRef = firstFocusedRef;
                            } else if (isAligned && !isFocused) {
                                thisRowRef = alignedRef;
                            }

                            const worker = workerByStableId[effective.actor_stable_id];

                            return (
                                <InteractionRow
                                    key={effective.oid}
                                    interaction={effective}
                                    worker={worker}
                                    isAligned={isAligned}
                                    inWindow={inWindow}
                                    isFocused={isFocused}
                                    onChange={handleRowChange}
                                    rowRef={thisRowRef}
                                />
                            );
                        });
                    })()
                )}
            </div>

            {/* Pagination */}
            <div className={`border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalCount}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
