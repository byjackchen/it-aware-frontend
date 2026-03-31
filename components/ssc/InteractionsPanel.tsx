'use client';

import { useRef, useEffect, useMemo } from 'react';
import { MessageCircle, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { InfiniteLoadTrigger } from '@/components/data/InfiniteLoadTrigger';
import type { Interaction, InteractionListResponse } from '@/lib/types/objects';

interface InteractionsPanelProps {
    dateFrom: string;
    dateTo: string;
    workerFilter?: string;
    highlightWindow: { start: number; end: number } | null;
    highlightWorkerStableId: string | null;
    alignedRowOid: string | null;
    onItemsChange?: (items: Interaction[]) => void;
}

function formatShortTime(dateStr: string, timezone: string): string {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
    });
}

export function InteractionsPanel({
    dateFrom,
    dateTo,
    workerFilter,
    highlightWindow,
    highlightWorkerStableId,
    alignedRowOid,
    onItemsChange,
}: InteractionsPanelProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const alignedRef = useRef<HTMLDivElement>(null);

    const query = useMemo(() => ({
        sort_by: 'created_at',
        order: 'desc' as const,
        ...(dateFrom ? { created_at_from: dateFrom } : {}),
        ...(dateTo ? { created_at_to: dateTo } : {}),
        ...(workerFilter ? { actor_stable_id: workerFilter } : {}),
    }), [dateFrom, dateTo, workerFilter]);

    const {
        items: interactions,
        total,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
    } = useInfiniteResource<Interaction, InteractionListResponse>('interactions', {
        pageSize: 300,
        auto: true,
        query,
        extractItems: (response) => response.items,
        extractTotal: (response) => response.total,
        inferHasMore: (response, _pageItems, totalLoaded) => totalLoaded < response.total,
    });

    // Notify parent of loaded items for alignment search
    useEffect(() => {
        onItemsChange?.(interactions);
    }, [interactions, onItemsChange]);

    // Scroll to aligned row when it changes
    useEffect(() => {
        if (alignedRowOid && alignedRef.current) {
            alignedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [alignedRowOid]);

    const isInWindow = (createdAt: string, actorStableId: string): boolean => {
        if (!highlightWindow) return false;
        if (highlightWorkerStableId && actorStableId !== highlightWorkerStableId) return false;
        const ts = new Date(createdAt).getTime();
        return ts >= highlightWindow.start && ts <= highlightWindow.end;
    };

    const columnHeaderClass = `text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-500'}`;
    const cellClass = `text-xs truncate ${isLight ? 'text-slate-700' : 'text-gray-300'}`;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Panel Header */}
            <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-white/5 border-white/10'
            }`}>
                <div className="flex items-center gap-2">
                    <MessageCircle className={`w-4 h-4 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`} />
                    <span className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        Chatbot Interactions
                    </span>
                </div>
                <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                    {interactions.length.toLocaleString()} loaded / {(total ?? interactions.length).toLocaleString()} total
                </span>
            </div>

            {/* Column Headers */}
            <div className={`grid grid-cols-[100px_80px_1fr_1fr_60px_60px_60px_60px_60px_60px_60px_40px_40px] gap-1 px-3 py-1.5 border-b ${
                isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-white/3 border-white/10'
            }`}>
                <div className={columnHeaderClass}>Time</div>
                <div className={columnHeaderClass}>User</div>
                <div className={columnHeaderClass}>Question</div>
                <div className={columnHeaderClass}>Answer</div>
                <div className={columnHeaderClass}>CI(ai)</div>
                <div className={columnHeaderClass}>CI(hu)</div>
                <div className={columnHeaderClass}>SC(ai)</div>
                <div className={columnHeaderClass}>SC(hu)</div>
                <div className={columnHeaderClass}>Lbl(ai)</div>
                <div className={columnHeaderClass}>Lbl(hu)</div>
                <div className={columnHeaderClass}>KBs</div>
                <div className={columnHeaderClass}>KB?</div>
                <div className={columnHeaderClass}>FB</div>
            </div>

            {/* Scrollable Rows */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                {isInitialLoading && interactions.length === 0 ? (
                    <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading interactions...
                        </span>
                    </div>
                ) : error && interactions.length === 0 ? (
                    <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                ) : interactions.length === 0 ? (
                    <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        No chatbot interactions found
                    </div>
                ) : (
                    <>
                        {interactions.map((interaction) => {
                            const inWindow = isInWindow(interaction.created_at, interaction.actor_stable_id);
                            const isAligned = interaction.oid === alignedRowOid;
                            const raw = interaction.content_raw || {};

                            let rowBg = '';
                            let borderLeft = '';
                            if (isAligned) {
                                rowBg = isLight ? 'bg-blue-50' : 'bg-blue-500/15';
                                borderLeft = 'border-l-3 border-l-blue-500';
                            } else if (inWindow) {
                                rowBg = isLight ? 'bg-blue-50/50' : 'bg-blue-500/8';
                                borderLeft = 'border-l-3 border-l-blue-500/40';
                            }

                            return (
                                <div
                                    key={interaction.oid}
                                    ref={isAligned ? alignedRef : undefined}
                                    className={`grid grid-cols-[100px_80px_1fr_1fr_60px_60px_60px_60px_60px_60px_60px_40px_40px] gap-1 px-3 py-2 border-b ${
                                        isLight ? 'border-slate-100' : 'border-white/5'
                                    } ${rowBg} ${borderLeft}`}
                                >
                                    <div className={`text-xs ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                                        {formatShortTime(interaction.created_at, timezone)}
                                    </div>
                                    <div className={`text-xs truncate font-medium ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>
                                        {interaction.actor_stable_id}
                                    </div>
                                    <div className={cellClass} title={interaction.content_text ?? ''}>
                                        {interaction.content_text ?? '—'}
                                    </div>
                                    <div className={cellClass} title={interaction.response_text ?? ''}>
                                        {interaction.response_text ?? '—'}
                                    </div>
                                    <div className={cellClass}>{String(raw.ci_ai ?? '—')}</div>
                                    <div className={cellClass}>{String(raw.ci_hu ?? '—')}</div>
                                    <div className={cellClass}>{String(raw.sc_ai ?? '—')}</div>
                                    <div className={cellClass}>{String(raw.sc_hu ?? '—')}</div>
                                    <div className={cellClass}>{String(raw.label_ai ?? '—')}</div>
                                    <div className={cellClass}>{String(raw.label_hu ?? '—')}</div>
                                    <div className={cellClass}>{String(raw.related_kbs ?? '—')}</div>
                                    <div className={cellClass}>{String(raw.kb_needs_improvement ?? '—')}</div>
                                    <div className={cellClass}>{String(raw.feedback ?? '—')}</div>
                                </div>
                            );
                        })}

                        {hasMore && (
                            <InfiniteLoadTrigger
                                disabled={isInitialLoading || isLoadingMore}
                                onVisible={() => void loadMore()}
                            />
                        )}

                        {isLoadingMore && (
                            <div className={`py-3 text-center text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                <span className="inline-flex items-center gap-2">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Loading more...
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
