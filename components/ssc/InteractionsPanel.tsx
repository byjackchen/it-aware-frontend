'use client';

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { MessageCircle, Loader2, Download, Filter, X, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { downloadDashboardXlsx } from '@/lib/api/exports';
import { detectLocalTimezone, formatLocalDate, localEndOfDayIso, localMidnightIso } from '@/lib/utils/datetime';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { Pagination } from '@/components/data/Pagination';
import { InteractionRow } from '@/components/ssc/InteractionRow';
import {
    REVIEW_CODES,
    REVIEW_CODE_LABELS,
    type Interaction,
    type InteractionListResponse,
    type ReviewCode,
    type WorkerContext,
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
    const timezone = detectLocalTimezone();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const alignedRef = useRef<HTMLDivElement | null>(null);
    const firstFocusedRef = useRef<HTMLDivElement | null>(null);

    const t = useTranslations('SSCDashboard');
    const [isDownloading, setIsDownloading] = useState(false);

    // Panel-level filters
    const [showFilters, setShowFilters] = useState(true);
    const [localUserFilter, setLocalUserFilter] = useState('');
    const [selectedAiCodes, setSelectedAiCodes] = useState<Set<ReviewCode | 'NA'>>(new Set());
    const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
    const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
    const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
    const [showCodeDropdown, setShowCodeDropdown] = useState(false);
    const [showRegionDropdown, setShowRegionDropdown] = useState(false);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [showDeptDropdown, setShowDeptDropdown] = useState(false);
    const codeDropdownRef = useRef<HTMLDivElement>(null);
    const regionDropdownRef = useRef<HTMLDivElement>(null);
    const countryDropdownRef = useRef<HTMLDivElement>(null);
    const deptDropdownRef = useRef<HTMLDivElement>(null);

    // Compute unique values for region/country/dept from workerMap
    const { regionOptions, countryOptions, deptOptions } = useMemo(() => {
        const regions = new Set<string>();
        const countries = new Set<string>();
        const depts = new Set<string>();
        for (const wc of Object.values(workerMap)) {
            if (wc.region) regions.add(wc.region);
            if (wc.country) countries.add(wc.country);
            if (wc.department) depts.add(wc.department);
        }
        return {
            regionOptions: [...regions].sort(),
            countryOptions: [...countries].sort(),
            deptOptions: [...depts].sort(),
        };
    }, [workerMap]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (codeDropdownRef.current && !codeDropdownRef.current.contains(e.target as Node)) {
                setShowCodeDropdown(false);
            }
            if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target as Node)) {
                setShowRegionDropdown(false);
            }
            if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
                setShowCountryDropdown(false);
            }
            if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) {
                setShowDeptDropdown(false);
            }
        }
        const anyOpen = showCodeDropdown || showRegionDropdown || showCountryDropdown || showDeptDropdown;
        if (anyOpen) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [showCodeDropdown, showRegionDropdown, showCountryDropdown, showDeptDropdown]);

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

    // Data loading — initial batch (first 500); later pages fetched on demand.
    // TZ-aware 2026-05-11 — see Appendix A rule #11 in merge-review SOP.
    const query = useMemo(
        () => ({
            sort_by: 'created_at',
            order: 'desc' as const,
            ...(dateFrom ? { created_at_from: localMidnightIso(dateFrom, timezone) } : {}),
            ...(dateTo ? { created_at_to: localEndOfDayIso(dateTo, timezone) } : {}),
            ...(workerFilter ? { actor_stable_id: workerFilter } : {}),
        }),
        [dateFrom, dateTo, workerFilter, timezone],
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

    // Client-side filtering
    const filteredInteractions = useMemo(() => {
        let items = interactions;
        if (localUserFilter.trim()) {
            const q = localUserFilter.trim().toLowerCase();
            items = items.filter(i => i.actor_stable_id?.toLowerCase().includes(q));
        }
        if (selectedAiCodes.size > 0) {
            items = items.filter(i => {
                const code = i.ai_code ?? 'NA';
                return selectedAiCodes.has(code as ReviewCode | 'NA');
            });
        }
        if (selectedRegions.size > 0) {
            items = items.filter(i => {
                const worker = workerByStableId[i.actor_stable_id];
                const region = worker?.region || '—';
                return selectedRegions.has(region);
            });
        }
        if (selectedCountries.size > 0) {
            items = items.filter(i => {
                const worker = workerByStableId[i.actor_stable_id];
                const country = worker?.country || '—';
                return selectedCountries.has(country);
            });
        }
        if (selectedDepts.size > 0) {
            items = items.filter(i => {
                const worker = workerByStableId[i.actor_stable_id];
                const dept = worker?.department || '—';
                return selectedDepts.has(dept);
            });
        }
        return items;
    }, [interactions, localUserFilter, selectedAiCodes, selectedRegions, selectedCountries, selectedDepts, workerByStableId]);

    const totalCount = total ?? interactions.length;
    const filteredCount = filteredInteractions.length;
    const hasActiveFilters = localUserFilter.trim() !== '' || selectedAiCodes.size > 0 || selectedRegions.size > 0 || selectedCountries.size > 0 || selectedDepts.size > 0;
    const effectiveTotal = hasActiveFilters ? filteredCount : totalCount;
    const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
    const localStartIdx = (currentPage - 1) * pageSize;
    const isLocalPage = hasActiveFilters || localStartIdx < interactions.length;

    const displayedInteractions = useMemo(() => {
        if (hasActiveFilters) {
            // When panel filters are active, paginate over filtered results locally
            return filteredInteractions.slice(localStartIdx, localStartIdx + pageSize);
        }
        if (localStartIdx < interactions.length) {
            return interactions.slice(localStartIdx, localStartIdx + pageSize);
        }
        if (remotePage?.page === currentPage) {
            return remotePage.items;
        }
        return [];
    }, [interactions, filteredInteractions, localStartIdx, hasActiveFilters, remotePage, currentPage, pageSize]);

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
            if (dateFrom) params.set('created_at_from', localMidnightIso(dateFrom, timezone));
            if (dateTo) params.set('created_at_to', localEndOfDayIso(dateTo, timezone));
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
        if (!hasActiveFilters && !isLocalPage && remotePage?.page !== currentPage && !isInitialLoading) {
            fetchRemotePage(currentPage);
        }
    }, [currentPage, isLocalPage, hasActiveFilters, remotePage?.page, isInitialLoading, fetchRemotePage]);

    // Reset pagination when filters or pageSize change
    useEffect(() => {
        setCurrentPage(1);
        setRemotePage(null);
    }, [pageSize, dateFrom, dateTo, workerFilter, localUserFilter, selectedAiCodes, selectedRegions, selectedCountries, selectedDepts]);

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
                    // Interactions xlsx accepts `datetime` — send ISO-with-offset
                    // so the backend's ensure_utc converts to UTC precisely.
                    created_at_from: dateFrom ? localMidnightIso(dateFrom, timezone) : undefined,
                    created_at_to: dateTo ? localEndOfDayIso(dateTo, timezone) : undefined,
                    actor_stable_id: workerFilter,
                },
                `ssc_faq_dashboard_${formatLocalDate(new Date(), timezone)}.xlsx`,
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
                        {hasActiveFilters
                            ? `${filteredCount.toLocaleString()} / ${totalCount.toLocaleString()} records`
                            : `${totalCount.toLocaleString()} records`
                        }
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowFilters(f => !f)}
                        title="Toggle filters"
                        className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                            showFilters || hasActiveFilters
                                ? isLight
                                    ? 'bg-indigo-100 text-indigo-700'
                                    : 'bg-indigo-500/20 text-indigo-300'
                                : isLight
                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    : 'bg-white/10 text-gray-200 hover:bg-white/20'
                        }`}
                    >
                        <Filter className="w-3 h-3" />
                        Filter
                        {hasActiveFilters && (
                            <span className={`ml-0.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                                isLight ? 'bg-indigo-600 text-white' : 'bg-indigo-400 text-black'
                            }`}>
                                {(localUserFilter.trim() ? 1 : 0) + (selectedAiCodes.size > 0 ? 1 : 0) + (selectedRegions.size > 0 ? 1 : 0) + (selectedCountries.size > 0 ? 1 : 0) + (selectedDepts.size > 0 ? 1 : 0)}
                            </span>
                        )}
                    </button>
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

            {/* Panel Filters */}
            {showFilters && (
                <div
                    className={`flex items-center gap-3 px-3 py-2 border-b ${
                        isLight ? 'bg-indigo-50/50 border-slate-200' : 'bg-indigo-950/20 border-white/10'
                    }`}
                >
                    {/* User search */}
                    <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            User:
                        </span>
                        <input
                            type="text"
                            value={localUserFilter}
                            onChange={e => setLocalUserFilter(e.target.value)}
                            placeholder="Search user..."
                            className={`w-36 text-xs px-2 py-1 rounded border ${
                                isLight
                                    ? 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-indigo-400'
                                    : 'bg-white/5 border-white/15 text-white placeholder:text-gray-500 focus:border-indigo-400'
                            } outline-none transition-colors`}
                        />
                        {localUserFilter && (
                            <button
                                type="button"
                                onClick={() => setLocalUserFilter('')}
                                className={`p-0.5 rounded ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {/* Code (AI) multi-select */}
                    <div className="flex items-center gap-1.5 relative" ref={codeDropdownRef}>
                        <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Code (AI):
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowCodeDropdown(v => !v)}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                                selectedAiCodes.size > 0
                                    ? isLight
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                        : 'bg-indigo-500/10 border-indigo-400/40 text-indigo-300'
                                    : isLight
                                        ? 'bg-white border-slate-200 text-slate-600'
                                        : 'bg-white/5 border-white/15 text-gray-300'
                            } transition-colors`}
                        >
                            {selectedAiCodes.size > 0
                                ? `${selectedAiCodes.size} selected`
                                : 'All'
                            }
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {selectedAiCodes.size > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelectedAiCodes(new Set())}
                                className={`p-0.5 rounded ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}

                        {/* Dropdown */}
                        {showCodeDropdown && (
                            <div className={`absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-lg py-1 min-w-[160px] ${
                                isLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/15'
                            }`}>
                                {/* NA option */}
                                <label className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer ${
                                    isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={selectedAiCodes.has('NA')}
                                        onChange={() => {
                                            setSelectedAiCodes(prev => {
                                                const next = new Set(prev);
                                                if (next.has('NA')) next.delete('NA');
                                                else next.add('NA');
                                                return next;
                                            });
                                        }}
                                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className={isLight ? 'text-slate-700' : 'text-gray-200'}>NA</span>
                                    <span className={`ml-auto ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>(empty)</span>
                                </label>
                                {REVIEW_CODES.map(code => (
                                    <label
                                        key={code}
                                        className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer ${
                                            isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedAiCodes.has(code)}
                                            onChange={() => {
                                                setSelectedAiCodes(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(code)) next.delete(code);
                                                    else next.add(code);
                                                    return next;
                                                });
                                            }}
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className={isLight ? 'text-slate-700' : 'text-gray-200'}>{code}</span>
                                        <span className={`ml-auto ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                            {REVIEW_CODE_LABELS[code].en}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Region multi-select */}
                    <div className="flex items-center gap-1.5 relative" ref={regionDropdownRef}>
                        <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Region:
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowRegionDropdown(v => !v)}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                                selectedRegions.size > 0
                                    ? isLight
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                        : 'bg-indigo-500/10 border-indigo-400/40 text-indigo-300'
                                    : isLight
                                        ? 'bg-white border-slate-200 text-slate-600'
                                        : 'bg-white/5 border-white/15 text-gray-300'
                            } transition-colors`}
                        >
                            {selectedRegions.size > 0 ? `${selectedRegions.size} selected` : 'All'}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {selectedRegions.size > 0 && (
                            <button type="button" onClick={() => setSelectedRegions(new Set())} className={`p-0.5 rounded ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-gray-500 hover:text-gray-300'}`}>
                                <X className="w-3 h-3" />
                            </button>
                        )}
                        {showRegionDropdown && (
                            <div className={`absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-lg py-1 min-w-[140px] max-h-[240px] overflow-y-auto ${
                                isLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/15'
                            }`}>
                                {regionOptions.map(r => (
                                    <label key={r} className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedRegions.has(r)}
                                            onChange={() => {
                                                setSelectedRegions(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(r)) next.delete(r); else next.add(r);
                                                    return next;
                                                });
                                            }}
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className={isLight ? 'text-slate-700' : 'text-gray-200'}>{r}</span>
                                    </label>
                                ))}
                                {regionOptions.length === 0 && (
                                    <div className={`px-3 py-2 text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>No options</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Country multi-select */}
                    <div className="flex items-center gap-1.5 relative" ref={countryDropdownRef}>
                        <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Country:
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowCountryDropdown(v => !v)}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                                selectedCountries.size > 0
                                    ? isLight
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                        : 'bg-indigo-500/10 border-indigo-400/40 text-indigo-300'
                                    : isLight
                                        ? 'bg-white border-slate-200 text-slate-600'
                                        : 'bg-white/5 border-white/15 text-gray-300'
                            } transition-colors`}
                        >
                            {selectedCountries.size > 0 ? `${selectedCountries.size} selected` : 'All'}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {selectedCountries.size > 0 && (
                            <button type="button" onClick={() => setSelectedCountries(new Set())} className={`p-0.5 rounded ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-gray-500 hover:text-gray-300'}`}>
                                <X className="w-3 h-3" />
                            </button>
                        )}
                        {showCountryDropdown && (
                            <div className={`absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-lg py-1 min-w-[160px] max-h-[240px] overflow-y-auto ${
                                isLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/15'
                            }`}>
                                {countryOptions.map(c => (
                                    <label key={c} className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedCountries.has(c)}
                                            onChange={() => {
                                                setSelectedCountries(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(c)) next.delete(c); else next.add(c);
                                                    return next;
                                                });
                                            }}
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className={isLight ? 'text-slate-700' : 'text-gray-200'}>{c}</span>
                                    </label>
                                ))}
                                {countryOptions.length === 0 && (
                                    <div className={`px-3 py-2 text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>No options</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Dept multi-select */}
                    <div className="flex items-center gap-1.5 relative" ref={deptDropdownRef}>
                        <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Dept:
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowDeptDropdown(v => !v)}
                            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border ${
                                selectedDepts.size > 0
                                    ? isLight
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                        : 'bg-indigo-500/10 border-indigo-400/40 text-indigo-300'
                                    : isLight
                                        ? 'bg-white border-slate-200 text-slate-600'
                                        : 'bg-white/5 border-white/15 text-gray-300'
                            } transition-colors`}
                        >
                            {selectedDepts.size > 0 ? `${selectedDepts.size} selected` : 'All'}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {selectedDepts.size > 0 && (
                            <button type="button" onClick={() => setSelectedDepts(new Set())} className={`p-0.5 rounded ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-gray-500 hover:text-gray-300'}`}>
                                <X className="w-3 h-3" />
                            </button>
                        )}
                        {showDeptDropdown && (
                            <div className={`absolute top-full left-0 mt-1 z-50 rounded-lg border shadow-lg py-1 min-w-[180px] max-h-[240px] overflow-y-auto ${
                                isLight ? 'bg-white border-slate-200' : 'bg-slate-800 border-white/15'
                            }`}>
                                {deptOptions.map(d => (
                                    <label key={d} className={`flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedDepts.has(d)}
                                            onChange={() => {
                                                setSelectedDepts(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(d)) next.delete(d); else next.add(d);
                                                    return next;
                                                });
                                            }}
                                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className={isLight ? 'text-slate-700' : 'text-gray-200'}>{d}</span>
                                    </label>
                                ))}
                                {deptOptions.length === 0 && (
                                    <div className={`px-3 py-2 text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>No options</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Clear all filters */}
                    <button
                        type="button"
                        disabled={!hasActiveFilters}
                        onClick={() => {
                            setLocalUserFilter('');
                            setSelectedAiCodes(new Set());
                            setSelectedRegions(new Set());
                            setSelectedCountries(new Set());
                            setSelectedDepts(new Set());
                        }}
                        className={`ml-auto flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
                            hasActiveFilters
                                ? isLight
                                    ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 shadow-sm'
                                    : 'bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-400/30'
                                : isLight
                                    ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed'
                                    : 'bg-white/5 text-gray-600 border border-white/10 cursor-not-allowed'
                        }`}
                    >
                        <X className="w-3.5 h-3.5" />
                        Clear All
                    </button>
                </div>
            )}

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
                    totalItems={effectiveTotal}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
