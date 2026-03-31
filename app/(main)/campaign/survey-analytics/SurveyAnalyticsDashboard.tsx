'use client';

import { useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { BatchSelector } from './BatchSelector';
import { SubmissionOverview } from './SubmissionOverview';
import { AnalysisClassification } from './AnalysisClassification';
import { NegativeFeedbackSection } from './NegativeFeedbackSection';
import { KeywordHeatmap } from './KeywordHeatmap';

export function SurveyAnalyticsDashboard() {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const t = useTranslations('SurveyAnalytics');
    const [selectedBatchOid, setSelectedBatchOid] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    const handleRefresh = () => {
        setRefreshKey((k) => k + 1);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {t('title')}
                            </h1>
                            <p className={`text-sm mt-0.5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                {t('subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <BatchSelector
                            selectedBatchOid={selectedBatchOid}
                            onBatchChange={setSelectedBatchOid}
                            isLight={isLight}
                        />
                        <button
                            onClick={handleRefresh}
                            className={`p-2 rounded-lg border transition-colors ${isLight
                                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                            }`}
                            title={t('refreshAll')}
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Dashboard Sections - each loads independently */}
                {selectedBatchOid ? (
                    <div key={refreshKey} className="space-y-8">
                        <SubmissionOverview batchOid={selectedBatchOid} isLight={isLight} />
                        <AnalysisClassification batchOid={selectedBatchOid} isLight={isLight} />
                        <NegativeFeedbackSection batchOid={selectedBatchOid} isLight={isLight} />
                        <KeywordHeatmap batchOid={selectedBatchOid} isLight={isLight} />
                    </div>
                ) : (
                    <div className={`rounded-xl border p-12 text-center ${isLight ? 'border-slate-200 bg-white text-slate-500' : 'border-white/10 bg-white/5 text-gray-400'}`}>
                        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p className="text-sm">{t('selectBatch')}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
