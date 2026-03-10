'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSurveyAnalytics } from '@/lib/hooks/useSurveyAnalytics';
import type { KeywordHeatmapResponse, GroupedKeywordHeatmapResponse } from '@/lib/types/survey-analytics';
import { KeywordTreemap } from './charts/KeywordTreemap';

interface KeywordHeatmapProps {
    batchOid: string;
    isLight: boolean;
}

type GroupLevel = null | 1 | 2 | 3;

const LEVEL_OPTIONS: Array<{ value: GroupLevel; labelKey: 'allKeywords' | 'L1' | 'L2' | 'L3' }> = [
    { value: null, labelKey: 'allKeywords' },
    { value: 1, labelKey: 'L1' },
    { value: 2, labelKey: 'L2' },
    { value: 3, labelKey: 'L3' },
];

export function KeywordHeatmap({ batchOid, isLight }: KeywordHeatmapProps) {
    const t = useTranslations('SurveyAnalytics');
    const [groupLevel, setGroupLevel] = useState<GroupLevel>(null);

    const url = batchOid
        ? `/api/dashboard/survey-analytics/keyword-heatmap?batch_oid=${batchOid}${groupLevel !== null ? `&group_level=${groupLevel}` : ''}`
        : null;

    const { data, isLoading, error } = useSurveyAnalytics<KeywordHeatmapResponse | GroupedKeywordHeatmapResponse>(url);

    const isGrouped = groupLevel !== null && data && 'groups' in data;

    if (isLoading) {
        return (
            <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                <span className={`inline-flex items-center gap-2 text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('keywords.loading')}
                </span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                <p className="text-sm">{error || t('keywords.loadFailed')}</p>
            </div>
        );
    }

    return (
        <section className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    {t('keywords.title')}
                </h2>

                <div className="flex items-center gap-2">
                    <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                        {t('keywords.groupBy')}:
                    </span>
                    <div className={`inline-flex rounded-lg border text-xs ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                        {LEVEL_OPTIONS.map((opt) => {
                            const isActive = opt.value === groupLevel;
                            const label = opt.labelKey === 'allKeywords' ? t('keywords.allKeywords') : opt.labelKey;
                            return (
                                <button
                                    key={opt.labelKey}
                                    onClick={() => setGroupLevel(opt.value)}
                                    className={`px-2.5 py-1 transition-colors first:rounded-l-lg last:rounded-r-lg ${
                                        isActive
                                            ? isLight
                                                ? 'bg-slate-800 text-white'
                                                : 'bg-white text-slate-900'
                                            : isLight
                                                ? 'text-slate-600 hover:bg-slate-100'
                                                : 'text-gray-400 hover:bg-white/10'
                                    }`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-green-500 inline-block" />
                    <span className={isLight ? 'text-slate-600' : 'text-gray-400'}>{t('keywords.positive')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-red-500 inline-block" />
                    <span className={isLight ? 'text-slate-600' : 'text-gray-400'}>{t('keywords.negative')}</span>
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-400 inline-block" />
                    <span className={isLight ? 'text-slate-600' : 'text-gray-400'}>{t('keywords.mixedNeutral')}</span>
                </span>
                <span className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                    {t('keywords.sizeFrequency')}
                </span>
            </div>

            <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                {isGrouped ? (
                    <KeywordTreemap
                        keywords={[]}
                        isLight={isLight}
                        groups={(data as GroupedKeywordHeatmapResponse).groups}
                        ungroupedKeywords={(data as GroupedKeywordHeatmapResponse).ungrouped_keywords}
                        ungroupedLabel={t('keywords.ungrouped')}
                    />
                ) : (
                    <KeywordTreemap
                        keywords={(data as KeywordHeatmapResponse).keywords ?? []}
                        isLight={isLight}
                    />
                )}
            </div>
        </section>
    );
}
