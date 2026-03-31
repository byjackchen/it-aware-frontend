'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, ClipboardList } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AnalysisPreview } from '@/lib/types/survey-analytics';

export interface NegativeTableItem {
    oid: string;
    name: string;
    negativeCount: number;
    totalCount: number;
    negativeAnalyses: AnalysisPreview[];
}

interface NegativeTableProps {
    data: NegativeTableItem[];
    isLight: boolean;
    hoveredIndex: number | null;
    onHover: (index: number | null) => void;
}

function AnalysisRow({ a, isLight }: { a: AnalysisPreview; isLight: boolean }) {
    const t = useTranslations('SurveyAnalytics');
    return (
        <div className={`flex items-start justify-between gap-2 py-1.5 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                        {a.topic}
                    </span>
                    {a.intent && (
                        <span className={`text-[10px] px-1.5 py-0 rounded-full ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'}`}>
                            {a.intent}
                        </span>
                    )}
                </div>
                {a.fact && (
                    <p className={`text-[11px] leading-relaxed truncate ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                        {a.fact}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
                <button
                    onClick={() => window.open(`/data/analyses/${a.oid}`, '_blank')}
                    className={`p-1 rounded transition-colors ${isLight
                        ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                        : 'text-gray-600 hover:text-blue-400 hover:bg-white/10'
                    }`}
                    title={t('popover.openAnalysis')}
                >
                    <FileText className="w-3 h-3" />
                </button>
                {a.source_oid && (
                    <button
                        onClick={() => window.open(`/data/surveys/${a.source_oid}`, '_blank')}
                        className={`p-1 rounded transition-colors ${isLight
                            ? 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                            : 'text-gray-600 hover:text-green-400 hover:bg-white/10'
                        }`}
                        title={t('popover.openSurvey')}
                    >
                        <ClipboardList className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    );
}

export function NegativeTable({ data, isLight, hoveredIndex, onHover }: NegativeTableProps) {
    const t = useTranslations('SurveyAnalytics');
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    return (
        <div className={`rounded-lg border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            {data.length === 0 ? (
                <div className={`p-8 text-center text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                    {t('negativeFeedback.noNegative')}
                </div>
            ) : (
                <div className="divide-y divide-inherit">
                    {data.map((item, index) => {
                        const isExpanded = expandedIndex === index;
                        const isHighlighted = hoveredIndex === index;
                        const negativePercent = item.totalCount > 0 ? Math.round((item.negativeCount / item.totalCount) * 100) : 0;
                        const inlineAnalyses = item.negativeAnalyses.slice(0, 3);
                        const hasMore = item.negativeAnalyses.length > 3;

                        return (
                            <div
                                key={item.oid}
                                className={`transition-colors ${isHighlighted
                                    ? isLight ? 'bg-red-50/50' : 'bg-red-500/5'
                                    : ''
                                }`}
                                onMouseEnter={() => onHover(index)}
                                onMouseLeave={() => onHover(null)}
                            >
                                {/* Main Row */}
                                <div className="px-4 py-3">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`text-sm font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {item.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm font-semibold text-red-500">
                                                {item.negativeCount}
                                            </span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500`}>
                                                {negativePercent}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Inline 3 typical issues */}
                                    <div className={`space-y-0.5 ${isLight ? 'divide-slate-100' : 'divide-white/5'}`}>
                                        {inlineAnalyses.map((a) => (
                                            <AnalysisRow key={a.oid} a={a} isLight={isLight} />
                                        ))}
                                    </div>

                                    {/* View More / Collapse button */}
                                    {hasMore && (
                                        <button
                                            onClick={() => setExpandedIndex(isExpanded ? null : index)}
                                            className={`mt-2 flex items-center gap-1 text-xs font-medium transition-colors ${isLight
                                                ? 'text-blue-600 hover:text-blue-700'
                                                : 'text-blue-400 hover:text-blue-300'
                                            }`}
                                        >
                                            {isExpanded ? (
                                                <>
                                                    <ChevronUp className="w-3 h-3" />
                                                    {t('negativeFeedback.collapse')}
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-3 h-3" />
                                                    {t('negativeFeedback.viewMore', { count: item.negativeAnalyses.length })}
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Expanded analyses */}
                                {isExpanded && (
                                    <div className={`px-4 pb-3 space-y-0.5 border-t ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/[0.02]'}`}>
                                        {item.negativeAnalyses.slice(3).map((a) => (
                                            <AnalysisRow key={a.oid} a={a} isLight={isLight} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
