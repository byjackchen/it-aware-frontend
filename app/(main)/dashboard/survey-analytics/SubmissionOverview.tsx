'use client';

import { useRouter } from 'next/navigation';
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
    const router = useRouter();
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

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                    className={`rounded-xl border p-4 cursor-pointer transition-colors ${isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    onClick={() => router.push('/data/surveys')}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <Users className={`w-4 h-4 ${isLight ? 'text-slate-500' : 'text-gray-500'}`} />
                        <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Total Sent</p>
                    </div>
                    <p className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {status_counts.total.toLocaleString()}
                    </p>
                </div>
                <div
                    className={`rounded-xl border p-4 cursor-pointer transition-colors ${isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    onClick={() => router.push('/data/surveys')}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className={`w-4 h-4 text-green-500`} />
                        <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Submitted</p>
                    </div>
                    <p className={`text-2xl font-semibold text-green-500`}>
                        {status_counts.submitted.toLocaleString()}
                    </p>
                </div>
                <div
                    className={`rounded-xl border p-4 cursor-pointer transition-colors ${isLight ? 'border-slate-200 bg-white hover:bg-slate-50' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                    onClick={() => router.push('/data/surveys')}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className={`w-4 h-4 ${isLight ? 'text-blue-500' : 'text-blue-400'}`} />
                        <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Response Rate</p>
                    </div>
                    <p className={`text-2xl font-semibold ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                        {response_rate}%
                    </p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h3 className={`text-sm font-medium mb-3 ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                        Response Status
                    </h3>
                    <ResponseRateDonut statusCounts={status_counts} isLight={isLight} batchOid={batchOid} />
                </div>
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
