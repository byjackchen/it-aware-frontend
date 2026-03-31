'use client';

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { AlertCircle, Loader2, Crosshair } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { Pagination } from '@/components/data/Pagination';
import type { Incident, IncidentListResponse } from '@/lib/types/objects';

interface IncidentsPanelProps {
    dateFrom: string;
    dateTo: string;
    workerFilter?: string;
    alignedIncidentOid: string | null;
    onAlign: (incident: Incident) => void;
    workerMap: Record<string, string>;
    catalogMap: Record<string, string>;
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

export function IncidentsPanel({
    dateFrom,
    dateTo,
    workerFilter,
    alignedIncidentOid,
    onAlign,
    workerMap,
    catalogMap,
}: IncidentsPanelProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';
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
            const stableId = workerMap[inc.actor_oid];
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

    const columnHeaderClass = `text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-500'}`;
    const cellClass = `text-xs truncate ${isLight ? 'text-slate-700' : 'text-gray-300'}`;

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
                <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                    {(totalIncidents ?? incidents.length).toLocaleString()} records
                </span>
            </div>

            {/* Column Headers */}
            <div className={`grid grid-cols-[50px_100px_1fr_60px_70px_90px_80px_70px_90px] gap-1 px-3 py-1.5 border-b ${
                isLight ? 'bg-slate-50/50 border-slate-200' : 'bg-white/3 border-white/10'
            }`}>
                <div className={columnHeaderClass}></div>
                <div className={columnHeaderClass}>Ticket ID</div>
                <div className={columnHeaderClass}>Summary</div>
                <div className={columnHeaderClass}>State</div>
                <div className={columnHeaderClass}>Channel</div>
                <div className={columnHeaderClass}>Category</div>
                <div className={columnHeaderClass}>Worker</div>
                <div className={columnHeaderClass}>KB ID</div>
                <div className={columnHeaderClass}>Time</div>
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
                        const isAligned = incident.oid === alignedIncidentOid;

                        return (
                            <div
                                key={incident.oid}
                                className={`grid grid-cols-[50px_100px_1fr_60px_70px_90px_80px_70px_90px] gap-1 px-3 py-2 border-b ${
                                    isLight ? 'border-slate-100' : 'border-white/5'
                                } ${isAligned ? (isLight ? 'bg-blue-50' : 'bg-blue-500/10') : ''}`}
                            >
                                <div>
                                    <button
                                        onClick={() => onAlign(incident)}
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                            isAligned
                                                ? 'bg-blue-500 text-white'
                                                : isLight
                                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                        }`}
                                        title="Align interactions timeline"
                                    >
                                        <Crosshair className="w-3 h-3 inline mr-0.5" />
                                        <span>对齐</span>
                                    </button>
                                </div>
                                <div className={`text-xs font-mono ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                                    <a
                                        href={`/data/incidents/${incident.oid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`hover:underline ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}
                                    >
                                        {incident.stable_id ?? '—'}
                                    </a>
                                </div>
                                <div className={cellClass} title={incident.title}>
                                    {incident.title}
                                </div>
                                <div className={cellClass}>
                                    {incident.state ?? '—'}
                                </div>
                                <div className={cellClass}>
                                    {incident.channel ?? '—'}
                                </div>
                                <div className={cellClass} title={incident.service_catalog_oid ?? ''}>
                                    {(incident.service_catalog_oid && catalogMap[incident.service_catalog_oid]) || '—'}
                                </div>
                                <div className={`text-xs truncate font-medium ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`} title={incident.actor_oid}>
                                    {workerMap[incident.actor_oid] || incident.actor_oid}
                                </div>
                                <div className={cellClass}>
                                    {String((incident.chat_transcripts as Record<string, unknown>)?.related_kb_id ?? '—')}
                                </div>
                                <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {formatShortTime(incident.effective_at, timezone)}
                                </div>
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
                    totalItems={workerFilter ? filteredIncidents.length : (totalIncidents ?? incidents.length)}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
