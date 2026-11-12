'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSurveyAnalytics } from '@/lib/hooks/useSurveyAnalytics';
import type { AnalysisClassificationResponse, ServiceCatalogBreakdown, ConfigItemBreakdown } from '@/lib/types/survey-analytics';
import { NegativeBar } from './charts/NegativeBar';
import { NegativeTable } from './charts/NegativeTable';
import type { NegativeBarItem } from './charts/NegativeBar';
import type { NegativeTableItem } from './charts/NegativeTable';

interface NegativeFeedbackSectionProps {
    batchOid: string;
    isLight: boolean;
}

type Dimension = 'service_catalog' | 'config_item';

function processBreakdown(items: (ServiceCatalogBreakdown | ConfigItemBreakdown)[], locationFilter: string | null) {
    let filtered = items;
    if (locationFilter) {
        filtered = items.filter((item) =>
            item.top_locations.some((loc) => loc.location_name === locationFilter)
        );
    }

    const processed = filtered
        .filter((item) => item.semantic.negative > 0)
        .sort((a, b) => b.semantic.negative - a.semantic.negative)
        .slice(0, 15);

    const barData: NegativeBarItem[] = processed.map((item) => ({
        oid: item.oid,
        name: item.name,
        negativeCount: item.semantic.negative,
    }));

    const tableData: NegativeTableItem[] = processed.map((item) => ({
        oid: item.oid,
        name: item.name,
        negativeCount: item.semantic.negative,
        totalCount: item.count,
        negativeAnalyses: item.analyses.filter((a) => a.semantic === 'negative'),
    }));

    return { barData, tableData };
}

export function NegativeFeedbackSection({ batchOid, isLight }: NegativeFeedbackSectionProps) {
    const t = useTranslations('SurveyAnalytics');
    const [dimension, setDimension] = useState<Dimension>('service_catalog');
    const [locationFilter, setLocationFilter] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const url = batchOid
        ? `/api/dashboard/survey-analytics/analysis-classification?batch_oid=${batchOid}`
        : null;
    const { data, isLoading, error } = useSurveyAnalytics<AnalysisClassificationResponse>(url);

    const locationOptions = useMemo(() => {
        if (!data) return [];
        return data.by_location.map((loc) => loc.location_name).sort();
    }, [data]);

    const { barData, tableData } = useMemo(() => {
        if (!data) return { barData: [], tableData: [] };
        const source = dimension === 'service_catalog'
            ? data.by_service_catalog
            : data.by_configuration_item;
        return processBreakdown(source, locationFilter);
    }, [data, dimension, locationFilter]);

    if (isLoading) {
        return (
            <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                <span className={`inline-flex items-center gap-2 text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('negativeFeedback.loading')}
                </span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                <p className="text-sm">{error || t('classification.loadFailed')}</p>
            </div>
        );
    }

    const DIMENSIONS: { key: Dimension; label: string }[] = [
        { key: 'service_catalog', label: t('negativeFeedback.serviceCatalog') },
        { key: 'config_item', label: t('negativeFeedback.configItem') },
    ];

    return (
        <section className="space-y-4">
            <h2 className={`flex items-center gap-2 text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                <AlertTriangle className="w-5 h-5 text-red-500" />
                {t('negativeFeedback.title')}
            </h2>

            {/* Controls Bar */}
            <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                {/* Dimension Toggle */}
                <div className={`flex rounded-lg border ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    {DIMENSIONS.map((dim) => (
                        <button
                            key={dim.key}
                            onClick={() => { setDimension(dim.key); setHoveredIndex(null); }}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${dimension === dim.key
                                ? isLight
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : 'bg-red-500/10 text-red-400'
                                : isLight
                                    ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                        >
                            {dim.label}
                        </button>
                    ))}
                </div>

                {/* Location Filter */}
                <select
                    value={locationFilter ?? ''}
                    onChange={(e) => { setLocationFilter(e.target.value || null); setHoveredIndex(null); }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${isLight
                        ? 'border-slate-200 bg-white text-slate-700'
                        : 'border-white/10 bg-white/5 text-gray-300'
                    }`}
                >
                    <option value="">{t('negativeFeedback.allLocations')}</option>
                    {locationOptions.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                    ))}
                </select>
            </div>

            {/* Content: Left chart + Right table */}
            {barData.length === 0 ? (
                <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                        {t('negativeFeedback.noNegative')}
                    </p>
                </div>
            ) : (
                <div className={`rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex flex-col lg:flex-row">
                        {/* Left: Bar Chart */}
                        <div className={`lg:w-2/5 p-4 border-b lg:border-b-0 lg:border-r ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <NegativeBar
                                data={barData}
                                isLight={isLight}
                                hoveredIndex={hoveredIndex}
                                onHover={setHoveredIndex}
                            />
                        </div>

                        {/* Right: Table */}
                        <div className="lg:w-3/5 p-4 overflow-y-auto" style={{ maxHeight: Math.max(320, barData.length * 36 + 40) }}>
                            <NegativeTable
                                data={tableData}
                                isLight={isLight}
                                hoveredIndex={hoveredIndex}
                                onHover={setHoveredIndex}
                            />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
