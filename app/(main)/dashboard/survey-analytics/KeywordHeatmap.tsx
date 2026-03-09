'use client';

import { Loader2 } from 'lucide-react';
import { useSurveyAnalytics } from '@/lib/hooks/useSurveyAnalytics';
import type { KeywordHeatmapResponse } from '@/lib/types/survey-analytics';
import { KeywordTreemap } from './charts/KeywordTreemap';

interface KeywordHeatmapProps {
    batchOid: string;
    isLight: boolean;
}

export function KeywordHeatmap({ batchOid, isLight }: KeywordHeatmapProps) {
    const url = batchOid ? `/api/dashboard/survey-analytics/keyword-heatmap?batch_oid=${batchOid}` : null;
    const { data, isLoading, error } = useSurveyAnalytics<KeywordHeatmapResponse>(url);

    if (isLoading) {
        return (
            <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                <span className={`inline-flex items-center gap-2 text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading keyword heatmap...
                </span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                <p className="text-sm">{error || 'Failed to load data'}</p>
            </div>
        );
    }

    return (
        <section className="space-y-4">
            <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                Keyword Heatmap
            </h2>

            <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-green-500 inline-block" />
                    <span className={isLight ? 'text-slate-600' : 'text-gray-400'}>Positive</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-red-500 inline-block" />
                    <span className={isLight ? 'text-slate-600' : 'text-gray-400'}>Negative</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-400 inline-block" />
                    <span className={isLight ? 'text-slate-600' : 'text-gray-400'}>Mixed/Neutral</span>
                </span>
                <span className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                    Size = frequency
                </span>
            </div>

            <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                <KeywordTreemap
                    keywords={data.keywords}
                    isLight={isLight}
                />
            </div>
        </section>
    );
}
