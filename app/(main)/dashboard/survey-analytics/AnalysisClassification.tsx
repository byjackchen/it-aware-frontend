'use client';

import { useState } from 'react';
import { Loader2, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSurveyAnalytics } from '@/lib/hooks/useSurveyAnalytics';
import type { AnalysisClassificationResponse } from '@/lib/types/survey-analytics';
import { ServiceCatalogBar } from './charts/ServiceCatalogBar';
import { ConfigItemBar } from './charts/ConfigItemBar';
import { IntentBreakdownBar } from './charts/IntentBreakdownBar';
import { LocationCrossRefTable } from './charts/LocationCrossRefTable';

interface AnalysisClassificationProps {
    batchOid: string;
    isLight: boolean;
}

type TabKey = 'service_catalog' | 'config_item' | 'intent' | 'location';

export function AnalysisClassification({ batchOid, isLight }: AnalysisClassificationProps) {
    const t = useTranslations('SurveyAnalytics');
    const [activeTab, setActiveTab] = useState<TabKey>('service_catalog');

    const TABS: { key: TabKey; label: string }[] = [
        { key: 'service_catalog', label: t('classification.serviceCatalog') },
        { key: 'config_item', label: t('classification.configurationItem') },
        { key: 'intent', label: t('classification.intent') },
        { key: 'location', label: t('classification.byLocation') },
    ];
    const url = batchOid ? `/api/dashboard/survey-analytics/analysis-classification?batch_oid=${batchOid}` : null;
    const { data, isLoading, error } = useSurveyAnalytics<AnalysisClassificationResponse>(url);

    if (isLoading) {
        return (
            <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                <span className={`inline-flex items-center gap-2 text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('classification.loading')}
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

    const { total_analyses, semantic_summary } = data;
    const totalSemantic = semantic_summary.positive + semantic_summary.negative + semantic_summary.neutral;
    const positivePercent = totalSemantic > 0 ? Math.round((semantic_summary.positive / totalSemantic) * 100) : 0;
    const negativePercent = totalSemantic > 0 ? Math.round((semantic_summary.negative / totalSemantic) * 100) : 0;

    return (
        <section className="space-y-4">
            <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {t('classification.title')}
            </h2>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                    className={`rounded-xl border p-4 cursor-pointer transition-colors ${isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    onClick={() => window.open(`/data/analyses?source_batch_oid=${batchOid}`, '_blank')}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Sparkles className={`w-4 h-4 ${isLight ? 'text-purple-500' : 'text-purple-400'}`} />
                        <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('classification.totalAnalyses')}</p>
                    </div>
                    <p className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {total_analyses.toLocaleString()}
                    </p>
                </div>
                <div
                    className={`rounded-xl border p-4 cursor-pointer transition-colors ${isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    onClick={() => window.open(`/data/analyses?source_batch_oid=${batchOid}`, '_blank')}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-500" />
                        <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('classification.positive')}</p>
                    </div>
                    <p className="text-2xl font-semibold text-green-500">
                        {positivePercent}%
                        <span className={`text-sm font-normal ml-2 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            ({semantic_summary.positive})
                        </span>
                    </p>
                </div>
                <div
                    className={`rounded-xl border p-4 cursor-pointer transition-colors ${isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    onClick={() => window.open(`/data/analyses?source_batch_oid=${batchOid}`, '_blank')}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-red-500" />
                        <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('classification.negative')}</p>
                    </div>
                    <p className="text-2xl font-semibold text-red-500">
                        {negativePercent}%
                        <span className={`text-sm font-normal ml-2 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            ({semantic_summary.negative})
                        </span>
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className={`rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                <div className={`flex border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.key
                                ? isLight
                                    ? 'text-blue-600 border-b-2 border-blue-600'
                                    : 'text-blue-400 border-b-2 border-blue-400'
                                : isLight
                                    ? 'text-slate-500 hover:text-slate-700'
                                    : 'text-gray-500 hover:text-gray-300'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-4">
                    {activeTab === 'service_catalog' && (
                        <ServiceCatalogBar data={data.by_service_catalog} isLight={isLight} />
                    )}
                    {activeTab === 'config_item' && (
                        <ConfigItemBar data={data.by_configuration_item} isLight={isLight} />
                    )}
                    {activeTab === 'intent' && (
                        <IntentBreakdownBar data={data.intent_summary} isLight={isLight} batchOid={batchOid} />
                    )}
                    {activeTab === 'location' && (
                        <LocationCrossRefTable data={data.by_location} isLight={isLight} batchOid={batchOid} />
                    )}
                </div>
            </div>
        </section>
    );
}
