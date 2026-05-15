'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { FileSearch, RefreshCw, Search, Loader2, Download } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { OverlaySpinner } from '@/components/layout/skeletons';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import { useAllActiveWorkers } from '@/components/campaign_surveys/useAllActiveWorkers';
import { useAllLocations } from '@/components/campaign_surveys/useAllLocations';
import type { SurveyBatch, Survey, SurveyBatchListResponse, SurveyListResponse } from '@/lib/types/objects';

const PAGE_SIZE = 1000;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    created: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
    published: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
    submitted: { bg: 'bg-green-500/20', text: 'text-green-500' },
    closed: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
    cancelled: { bg: 'bg-red-500/20', text: 'text-red-500' },
};

export function SurveysListPage() {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');

    const [batches, setBatches] = useState<SurveyBatch[]>([]);
    const [selectedBatchOid, setSelectedBatchOid] = useState<string>('');
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [totalSurveys, setTotalSurveys] = useState<number | null>(null);
    const [isLoadingBatches, setIsLoadingBatches] = useState(true);
    const [isLoadingSurveys, setIsLoadingSurveys] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exportProgress, setExportProgress] = useState<number | null>(null);
    const exportAbortRef = useRef<AbortController | null>(null);

    // Workers — fetched on mount in parallel with batches/surveys; provides denormalized
    // country_name/region_name for the export. is_active=true is intentional: departed
    // workers fall through to empty geo cells in the export, which is acceptable.
    const { workers, error: workersError, isLoading: isLoadingWorkers } = useAllActiveWorkers();
    const { locations, error: locationsError, isLoading: isLoadingLocations } = useAllLocations();

    // Fetch batches on mount
    useEffect(() => {
        let cancelled = false;
        async function fetchBatches() {
            setIsLoadingBatches(true);
            setError(null);
            try {
                const res = await fetch('/api/campaigns/survey_batchs?limit=1000');
                if (!res.ok) throw new Error('Failed to load survey batches');
                const data: SurveyBatchListResponse = await res.json();
                if (!cancelled) {
                    setBatches(data.items || []);
                    if (data.items?.length) {
                        setSelectedBatchOid(data.items[0].oid);
                    }
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                if (!cancelled) setIsLoadingBatches(false);
            }
        }
        void fetchBatches();
        return () => { cancelled = true; };
    }, []);

    // useRef so the abort controller survives re-renders without invalidating
    // the useCallback identity.
    const surveysAbortRef = useRef<AbortController | null>(null);

    // Fetch ALL surveys (paginated) when batch changes. Coalesces setState
    // calls across pages to avoid cascading re-renders on large batches, and
    // aborts in-flight fetches when the batch selection changes mid-load.
    const fetchAllSurveys = useCallback(async (batchOid: string, signal: AbortSignal) => {
        if (!batchOid) {
            setSurveys([]);
            setTotalSurveys(null);
            return;
        }
        setIsLoadingSurveys(true);
        setError(null);
        setSurveys([]);
        setTotalSurveys(null);

        const allItems: Survey[] = [];
        let skip = 0;
        let total = 0;
        const COALESCE_PAGES = 4;
        let pagesSinceFlush = 0;

        try {
            // eslint-disable-next-line no-constant-condition
            while (true) {
                const res = await fetch(
                    `/api/campaigns/survey_batchs/${encodeURIComponent(batchOid)}/surveys?limit=${PAGE_SIZE}&skip=${skip}`,
                    { signal },
                );
                if (!res.ok) throw new Error('Failed to load surveys');
                const data: SurveyListResponse = await res.json();
                total = data.total;
                allItems.push(...(data.items || []));
                pagesSinceFlush += 1;

                const isLastPage =
                    allItems.length >= total || (data.items?.length ?? 0) < PAGE_SIZE;

                if (isLastPage || pagesSinceFlush >= COALESCE_PAGES) {
                    setSurveys([...allItems]);
                    setTotalSurveys(total);
                    pagesSinceFlush = 0;
                }

                if (isLastPage) break;
                skip += PAGE_SIZE;
            }
        } catch (err) {
            // AbortError = stale fetch superseded by a newer one; not user-visible.
            if (err instanceof DOMException && err.name === 'AbortError') return;
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            if (!signal.aborted) setIsLoadingSurveys(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedBatchOid) return;
        surveysAbortRef.current?.abort();
        const controller = new AbortController();
        surveysAbortRef.current = controller;
        void fetchAllSurveys(selectedBatchOid, controller.signal);
        return () => controller.abort();
    }, [selectedBatchOid, fetchAllSurveys]);

    const filteredSurveys = useMemo(() => {
        if (searchQuery === '') return surveys;
        const q = searchQuery.toLowerCase();
        return surveys.filter((s) => s.receiver_stable_id.toLowerCase().includes(q));
    }, [surveys, searchQuery]);

    // Map location_oid → Location.name. Built from the full Locations list so we
    // can resolve the leaf office/site that Worker.location_oid points at. The
    // backend's Worker list endpoint denormalizes country_name/region_name but
    // not the location name, so this lookup lives client-side.
    const locationNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const loc of locations) {
            map.set(loc.oid, loc.name);
        }
        return map;
    }, [locations]);

    // Map worker_oid → denormalized country/region + resolved location name.
    // Used by both the row renderer and handleExportExcel. Any field can be null
    // when the backend has not resolved geo for that worker or when location_oid
    // points at a stale/unknown location.
    const workerGeoMap = useMemo(() => {
        const map = new Map<string, { country: string | null; region: string | null; location: string | null }>();
        for (const w of workers) {
            const locationName = w.location_oid ? locationNameMap.get(w.location_oid) ?? null : null;
            map.set(w.oid, {
                country: w.country_name ?? null,
                region: w.region_name ?? null,
                location: locationName,
            });
        }
        return map;
    }, [workers, locationNameMap]);

    const selectedBatch = batches.find(b => b.oid === selectedBatchOid);

    const handleRefresh = () => {
        if (!selectedBatchOid) return;
        surveysAbortRef.current?.abort();
        const controller = new AbortController();
        surveysAbortRef.current = controller;
        void fetchAllSurveys(selectedBatchOid, controller.signal);
    };

    // Guard: only enable export when ALL data the exporter depends on has resolved.
    // Prevents partial-row and blank-geo exports that silently diverge from the UI.
    const isExportReady = !isLoadingSurveys && !isLoadingWorkers && !isLoadingLocations && filteredSurveys.length > 0;

    const handleExportExcel = useCallback(async () => {
        if (!isExportReady) return;

        exportAbortRef.current?.abort();
        const controller = new AbortController();
        exportAbortRef.current = controller;
        setExportProgress(0);

        try {
            const { exportSurveysXlsx } = await import('./exportSurveysXlsx');
            await exportSurveysXlsx({
                surveys: filteredSurveys,
                batchName: selectedBatch?.name ?? 'batch',
                workerGeoMap,
                signal: controller.signal,
                onProgress: (pct) => setExportProgress(pct),
            });
        } catch (err) {
            console.error('Export failed:', err);
            setError(err instanceof Error ? err.message : 'Export failed');
        } finally {
            setExportProgress(null);
        }
    }, [isExportReady, filteredSurveys, selectedBatch, workerGeoMap]);

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400'}`}>
                            <FileSearch className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Surveys</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {filteredSurveys.length.toLocaleString()} Shown / {surveys.length.toLocaleString()} Loaded
                                {totalSurveys !== null && ` / ${totalSurveys.toLocaleString()} Total`}
                                {selectedBatch && ` • ${selectedBatch.name}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            disabled={!isExportReady}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'} disabled:opacity-30 disabled:cursor-not-allowed`}
                            title={
                                isLoadingSurveys
                                    ? 'Loading surveys — export will be enabled when all rows are loaded'
                                    : isLoadingWorkers
                                        ? 'Loading worker geo data — export will be enabled shortly'
                                        : isLoadingLocations
                                            ? 'Loading office/site locations — export will be enabled shortly'
                                            : filteredSurveys.length === 0
                                                ? 'No surveys to export'
                                                : 'Export to Excel'
                            }
                        >
                            {isLoadingSurveys || isLoadingWorkers || isLoadingLocations ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Download className="w-5 h-5" />
                            )}
                        </button>
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isLoadingSurveys ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Batch selector + Search */}
                <div className="flex items-center gap-4 mb-4">
                    <select
                        key={isLoadingBatches ? 'loading' : 'loaded'}
                        value={selectedBatchOid}
                        onChange={(e) => setSelectedBatchOid(e.target.value)}
                        disabled={isLoadingBatches}
                        className={`px-3 py-2 rounded-lg min-w-[200px] ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
                    >
                        {isLoadingBatches ? (
                            <option>Loading batches...</option>
                        ) : batches.length === 0 ? (
                            <option>No batches found</option>
                        ) : (
                            batches.map(b => (
                                <option key={b.oid} value={b.oid}>{b.name} ({b.status})</option>
                            ))
                        )}
                    </select>
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by receiver stable_id..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-indigo-500/50`}
                        />
                    </div>
                </div>

                {/* Worker/location geo data failure banner — export still works, but affected cells will be empty */}
                {(workersError || locationsError) && (
                    <div className={`mb-4 px-3 py-2 rounded-lg text-xs ${isLight ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                        {workersError && locationsError
                            ? 'Country/Region/Location unavailable — worker and location data failed to load. Export will still run with empty geo columns.'
                            : workersError
                                ? 'Country/Region unavailable — worker geo data failed to load. Export will still run with empty geo columns.'
                                : 'Location unavailable — office/site data failed to load. Export will still run with empty Location cells.'}
                    </div>
                )}

                {/* Loading progress */}
                {isLoadingSurveys && surveys.length > 0 && (
                    <div className={`mb-4 text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading surveys... {surveys.length.toLocaleString()}{totalSurveys !== null && ` / ${totalSurveys.toLocaleString()}`}
                        </span>
                    </div>
                )}

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {(isLoadingBatches || isLoadingSurveys) && surveys.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading surveys...</span>
                        </div>
                    ) : error && surveys.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredSurveys.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No surveys found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredSurveys.map((survey) => {
                                const statusStyle = STATUS_COLORS[survey.status] || STATUS_COLORS.created;
                                // receiver_oid is null for externally-sourced surveys (external_source !== null).
                                const geo = survey.receiver_oid ? workerGeoMap.get(survey.receiver_oid) : undefined;
                                const locationLabel = geo?.location ?? '—';
                                const submittedLabel = survey.submitted_at
                                    ? `Submitted ${new Date(survey.submitted_at).toLocaleDateString()}`
                                    : 'Not submitted';
                                return (
                                    <button
                                        key={survey.oid}
                                        onClick={() => router.push(`/data/surveys/${survey.oid}?batch=${survey.survey_batch_oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {survey.receiver_stable_id}
                                            </div>
                                            <div className={`text-sm truncate ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {submittedLabel} · {locationLabel}
                                                {survey.external_id && (
                                                    <> · <span className="font-mono">{survey.external_id}</span></>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {survey.external_source === 'servicenow' && (
                                                <span
                                                    className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-500"
                                                    title="Imported from ServiceNow"
                                                >
                                                    SN
                                                </span>
                                            )}
                                            {survey.external_source && survey.external_source !== 'servicenow' && (
                                                <span
                                                    className="text-xs px-2 py-1 rounded-full bg-slate-500/20 text-slate-500"
                                                    title={`External source: ${survey.external_source}`}
                                                >
                                                    {survey.external_source}
                                                </span>
                                            )}
                                            <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                                                {survey.status}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            {exportProgress !== null && (
                <OverlaySpinner text="Exporting surveys..." progress={exportProgress} />
            )}
        </div>
    );
}
