'use client';

import { Loader2, Users, CheckCircle2, TrendingUp } from 'lucide-react';
import { useSurveyAnalytics } from '@/lib/hooks/useSurveyAnalytics';
import type { SubmissionOverviewResponse } from '@/lib/types/survey-analytics';
import { ResponseRateDonut } from './charts/ResponseRateDonut';
import { GeoDistributionBar } from './charts/GeoDistributionBar';

interface SubmissionOverviewProps {
    batchOid: string;
    isLight: boolean;
}

export function SubmissionOverview({ batchOid, isLight }: SubmissionOverviewProps) {
    const url = batchOid ? `/api/dashboard/survey-analytics/submission-overview?batch_oid=${batchOid}` : null;
    const { data, isLoading, error } = useSurveyAnalytics<SubmissionOverviewResponse>(url);

    if (isLoading) {
        return (
            <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                <span className={`inline-flex items-center gap-2 text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading submission overview...
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

    const { status_counts, response_rate, geo_distribution } = data;

    return (
        <section className="space-y-4">
            <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                Survey Submission Overview
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Stats + donut in one card */}
                <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div
                            className={`rounded-lg p-3 cursor-pointer transition-colors ${isLight ? 'bg-slate-50 hover:bg-slate-100' : 'bg-white/5 hover:bg-white/10'}`}
                            onClick={() => window.open('/data/surveys', '_blank')}
                        >
                            <div className="flex items-center gap-1.5 mb-1">
                                <Users className={`w-3.5 h-3.5 ${isLight ? 'text-slate-500' : 'text-gray-500'}`} />
                                <p className={`text-[10px] uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Total Sent</p>
                            </div>
                            <p className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {status_counts.total.toLocaleString()}
                            </p>
                        </div>
                        <div
                            className={`rounded-lg p-3 cursor-pointer transition-colors ${isLight ? 'bg-slate-50 hover:bg-slate-100' : 'bg-white/5 hover:bg-white/10'}`}
                            onClick={() => window.open('/data/surveys', '_blank')}
                        >
                            <div className="flex items-center gap-1.5 mb-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                <p className={`text-[10px] uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Submitted</p>
                            </div>
                            <p className="text-xl font-bold text-green-500">
                                {status_counts.submitted.toLocaleString()}
                            </p>
                        </div>
                        <div
                            className={`rounded-lg p-3 cursor-pointer transition-colors ${isLight ? 'bg-slate-50 hover:bg-slate-100' : 'bg-white/5 hover:bg-white/10'}`}
                            onClick={() => window.open('/data/surveys', '_blank')}
                        >
                            <div className="flex items-center gap-1.5 mb-1">
                                <TrendingUp className={`w-3.5 h-3.5 ${isLight ? 'text-blue-500' : 'text-blue-400'}`} />
                                <p className={`text-[10px] uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Response Rate</p>
                            </div>
                            <p className={`text-xl font-bold ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                                {response_rate}%
                            </p>
                        </div>
                    </div>
                    <ResponseRateDonut statusCounts={status_counts} isLight={isLight} batchOid={batchOid} />
                </div>

                {/* Submissions by Location */}
                <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h3 className={`text-sm font-medium mb-3 ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                        Submissions by Location
                    </h3>
                    <GeoDistributionBar data={geo_distribution} isLight={isLight} />
                </div>
            </div>
        </section>
    );
}
