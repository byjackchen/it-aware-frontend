'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, RefreshCw, Search, Loader2, Filter } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import type { Analysis, AnalysisListResponse, ServiceCatalog } from '@/lib/types/objects';

const PAGE_SIZE = 1000;

interface ServiceCatalogListResponse {
    items: ServiceCatalog[];
    total: number;
}

interface SurveyBatchItem {
    oid: string;
    name: string;
}

interface SurveyBatchListResponse {
    items: SurveyBatchItem[];
    total: number;
}

const SEMANTIC_COLORS: Record<string, { bg: string; text: string }> = {
    positive: { bg: 'bg-green-500/20', text: 'text-green-500' },
    negative: { bg: 'bg-red-500/20', text: 'text-red-500' },
};

const INTENT_COLORS: Record<string, { bg: string; text: string }> = {
    request: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
    bug: { bg: 'bg-red-500/20', text: 'text-red-500' },
    complaint: { bg: 'bg-orange-500/20', text: 'text-orange-500' },
    praise: { bg: 'bg-green-500/20', text: 'text-green-500' },
    suggestion: { bg: 'bg-purple-500/20', text: 'text-purple-500' },
};

export function AnalysesListPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');

    const [analyses, setAnalyses] = useState<Analysis[]>([]);
    const [totalAnalyses, setTotalAnalyses] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scMap, setScMap] = useState<Record<string, string>>({});
    const [batchMap, setBatchMap] = useState<Record<string, string>>({});
    const [batches, setBatches] = useState<SurveyBatchItem[]>([]);
    const [filterBatchOid, setFilterBatchOid] = useState('');

    // Fetch service catalogs and survey batches for name resolution
    useEffect(() => {
        async function fetchServiceCatalogs() {
            try {
                const res = await fetch('/api/objects/service-catalogs?limit=1000');
                if (!res.ok) return;
                const data: ServiceCatalogListResponse = await res.json();
                const map: Record<string, string> = {};
                for (const sc of data.items || []) {
                    map[sc.oid] = sc.name;
                }
                setScMap(map);
            } catch { /* ignore */ }
        }
        async function fetchBatches() {
            try {
                const res = await fetch('/api/campaigns/survey_batchs?limit=1000');
                if (!res.ok) return;
                const data: SurveyBatchListResponse = await res.json();
                setBatches(data.items || []);
                const map: Record<string, string> = {};
                for (const b of data.items || []) {
                    map[b.oid] = b.name;
                }
                setBatchMap(map);
            } catch { /* ignore */ }
        }
        void fetchServiceCatalogs();
        void fetchBatches();
    }, []);

    const fetchAllAnalyses = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setAnalyses([]);
        setTotalAnalyses(null);

        try {
            const allItems: Analysis[] = [];
            let skip = 0;
            let total = 0;

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const params = new URLSearchParams({ limit: String(PAGE_SIZE), skip: String(skip) });
                if (filterBatchOid) params.set('source_batch_oid', filterBatchOid);
                const res = await fetch(`/api/objects/analysiss?${params}`);
                if (!res.ok) throw new Error('Failed to load analyses');
                const data: AnalysisListResponse = await res.json();
                total = data.total;
                allItems.push(...(data.items || []));
                setAnalyses([...allItems]);
                setTotalAnalyses(total);

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
    }, [filterBatchOid]);

    useEffect(() => {
        void fetchAllAnalyses();
    }, [fetchAllAnalyses]);

    const filteredAnalyses = useMemo(() => {
        if (searchQuery === '') return analyses;
        const q = searchQuery.toLowerCase();
        return analyses.filter((a) => {
            const kw = a.keywords?.join(' ').toLowerCase() || '';
            return a.topic.toLowerCase().includes(q)
                || kw.includes(q)
                || (a.fact?.toLowerCase().includes(q) ?? false)
                || a.source_type.toLowerCase().includes(q)
                || (a.semantic?.toLowerCase().includes(q) ?? false)
                || (a.intent?.toLowerCase().includes(q) ?? false);
        });
    }, [analyses, searchQuery]);

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Analyses</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {filteredAnalyses.length.toLocaleString()} Shown / {analyses.length.toLocaleString()} Loaded
                                {totalAnalyses !== null && ` / ${totalAnalyses.toLocaleString()} Total`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => void fetchAllAnalyses()} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search keywords, semantic, intent..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                        />
                    </div>
                    <select
                        value={filterBatchOid}
                        onChange={(e) => setFilterBatchOid(e.target.value)}
                        className={`px-3 py-2 rounded-lg text-sm ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-purple-500/50`}
                    >
                        <option value="">All Batches</option>
                        {batches.map((b) => (
                            <option key={b.oid} value={b.oid}>{b.name}</option>
                        ))}
                    </select>
                </div>

                {/* Loading progress */}
                {isLoading && analyses.length > 0 && (
                    <div className={`mb-4 text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading analyses... {analyses.length.toLocaleString()}{totalAnalyses !== null && ` / ${totalAnalyses.toLocaleString()}`}
                        </span>
                    </div>
                )}

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {isLoading && analyses.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading analyses...</span>
                        </div>
                    ) : error && analyses.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredAnalyses.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No analyses found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredAnalyses.map((analysis) => {
                                const semStyle = analysis.semantic ? SEMANTIC_COLORS[analysis.semantic] : null;
                                const intStyle = analysis.intent ? INTENT_COLORS[analysis.intent] : null;
                                return (
                                    <button
                                        key={analysis.oid}
                                        onClick={() => router.push(`/data/analyses/${analysis.oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {analysis.topic}
                                            </div>
                                            <div className={`text-sm truncate ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {analysis.fact || (analysis.keywords?.length ? analysis.keywords.join(', ') : analysis.source_type)}
                                            </div>
                                            {(analysis.source_batch_oid || analysis.service_catalog_oid || analysis.configuration_item_oid) && (
                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                    {analysis.source_batch_oid && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500">
                                                            {batchMap[analysis.source_batch_oid] || analysis.source_batch_oid}
                                                        </span>
                                                    )}
                                                    {analysis.service_catalog_oid && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500">
                                                            {scMap[analysis.service_catalog_oid] || analysis.service_catalog_oid}
                                                        </span>
                                                    )}
                                                    {analysis.configuration_item_oid && (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-500">
                                                            {scMap[analysis.configuration_item_oid] || analysis.configuration_item_oid}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 ml-4 shrink-0">
                                            {semStyle && (
                                                <span className={`text-xs px-2 py-1 rounded-full capitalize ${semStyle.bg} ${semStyle.text}`}>
                                                    {analysis.semantic}
                                                </span>
                                            )}
                                            {intStyle && (
                                                <span className={`text-xs px-2 py-1 rounded-full capitalize ${intStyle.bg} ${intStyle.text}`}>
                                                    {analysis.intent}
                                                </span>
                                            )}
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
