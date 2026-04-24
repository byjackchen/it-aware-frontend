'use client';


import { useCallback, useState } from 'react';
import {
    ArrowRight,
    BarChart2,
    CheckCircle2,
    Eye,
    HelpCircle,
    PhoneCall,
    
    TrendingUp,
    Users,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from '@/lib/contexts/theme-context';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import type { FAQEnquiryItem, InteractionFAQReport, MonthStats } from '@/lib/types/objects';

interface Props {
    report: InteractionFAQReport | null;
    error: string | null;
}

const CODE_COLORS: Record<string, string> = {
    ACCT: '#22c55e',
    IMP: '#f59e0b',
    ERR: '#ef4444',
    QNC: '#3b82f6',
    NA: '#94a3b8',
};

function pct(value: number): string {
    return `${value.toFixed(2)}%`;
}

function formatCountDelta(current: number, previous: number): { value: string; trend: 'up' | 'down' | 'flat' } {
    const diff = current - previous;
    if (diff === 0) return { value: 'Flat vs previous period', trend: 'flat' };
    return {
        value: `${diff > 0 ? '+' : ''}${diff.toLocaleString()} vs previous period`,
        trend: diff > 0 ? 'up' : 'down',
    };
}

function formatRateDelta(current: number, previous: number, lowerIsBetter = false): { value: string; trend: 'up' | 'down' | 'flat' } {
    const diff = Number((current - previous).toFixed(2));
    if (diff === 0) return { value: 'Flat vs previous period', trend: 'flat' };
    const improved = lowerIsBetter ? diff < 0 : diff > 0;
    return {
        value: `${diff > 0 ? '+' : ''}${diff.toFixed(2)} pts vs previous period`,
        trend: improved ? 'up' : 'down',
    };
}

function codeCount(stats: MonthStats, code: string): number {
    return stats.breakdown.find((item) => item.code === code)?.count ?? 0;
}

function codeShare(stats: MonthStats, code: string): number {
    return stats.breakdown.find((item) => item.code === code)?.percentage ?? 0;
}

function compareCodes(current: MonthStats, previous: MonthStats) {
    const labels = new Map<string, string>();
    for (const row of [...current.breakdown, ...previous.breakdown]) labels.set(row.code, row.display);
    return Array.from(labels.entries())
        .map(([code, display]) => {
            const currentCount = codeCount(current, code);
            const previousCount = codeCount(previous, code);
            const currentShare = codeShare(current, code);
            const previousShare = codeShare(previous, code);
            return {
                code,
                display,
                currentCount,
                previousCount,
                currentShare,
                previousShare,
                deltaCount: currentCount - previousCount,
                deltaShare: Number((currentShare - previousShare).toFixed(2)),
            };
        })
        .sort((a, b) => b.currentCount - a.currentCount);
}

function buildHighlights(report: InteractionFAQReport): Array<{ title: string; detail: string; tone: 'good' | 'warn' | 'neutral' }> {
    const { current, previous, top5_faq } = report;
    const topFaq = top5_faq[0];
    const resolutionDiff = Number((current.faq_resolution_rate - previous.faq_resolution_rate).toFixed(2));
    const escalationDiff = Number((current.human_escalation_rate - previous.human_escalation_rate).toFixed(2));
    const naShare = codeShare(current, 'NA');
    const acctShare = codeShare(current, 'ACCT');

    return [
        {
            title: resolutionDiff >= 0 ? 'Resolution is improving' : 'Resolution slipped',
            detail: `${pct(current.faq_resolution_rate)} this period, ${resolutionDiff >= 0 ? '+' : ''}${resolutionDiff.toFixed(2)} pts vs previous.`,
            tone: resolutionDiff >= 0 ? 'good' : 'warn',
        },
        {
            title: escalationDiff <= 0 ? 'Human handoff contained' : 'Handoff pressure rising',
            detail: `${pct(current.human_escalation_rate)} of sessions reached a human, ${escalationDiff >= 0 ? '+' : ''}${escalationDiff.toFixed(2)} pts vs previous.`,
            tone: escalationDiff <= 0 ? 'good' : 'warn',
        },
        {
            title: naShare >= 20 ? 'A lot of traffic is not FAQ-shaped' : 'Most traffic looks FAQ-relevant',
            detail: `NA share is ${pct(naShare)}. ACCT share of all traffic is ${pct(acctShare)}.`,
            tone: naShare >= 20 ? 'warn' : 'neutral',
        },
        {
            title: topFaq ? `Top demand: ${topFaq.name}` : 'No top FAQ data',
            detail: topFaq
                ? `${topFaq.count.toLocaleString()} enquiries, ${pct(topFaq.percentage)} of top-5 FAQ demand.`
                : 'No catalog-linked FAQ enquiries were returned for this period.',
            tone: topFaq ? 'neutral' : 'warn',
        },
    ];
}

function Tooltip({ text }: { text: string }) {
    return (
        <span className="group relative inline-flex items-center">
            <HelpCircle className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-slate-600 dark:group-hover:text-slate-200" />
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] leading-5 text-slate-600 shadow-lg group-hover:block dark:border-white/10 dark:bg-slate-950 dark:text-slate-300">
                {text}
            </span>
        </span>
    );
}

function SectionTitle({ title, subtitle, tooltip }: { title: string; subtitle?: string; tooltip?: string }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div>
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
                    {tooltip ? <Tooltip text={tooltip} /> : null}
                </div>
                {subtitle ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
            </div>
        </div>
    );
}

function DateRangeControls({ startDate, endDate }: { startDate: string; endDate: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [draftStart, setDraftStart] = useState(startDate);
    const [draftEnd, setDraftEnd] = useState(endDate);

    const apply = useCallback(() => {
        if (!draftStart || !draftEnd || draftStart > draftEnd) return;
        const params = new URLSearchParams(searchParams.toString());
        params.set('start_date', draftStart);
        params.set('end_date', draftEnd);
        router.push(`?${params.toString()}`);
    }, [draftEnd, draftStart, router, searchParams]);

    return (
        <div className="flex flex-wrap items-center gap-2">
            <input
                type="date"
                value={draftStart}
                max={draftEnd}
                onChange={(e) => setDraftStart(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
            <ArrowRight className="h-4 w-4 text-slate-400" />
            <input
                type="date"
                value={draftEnd}
                min={draftStart}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
            <button
                type="button"
                onClick={apply}
                disabled={!draftStart || !draftEnd || draftStart > draftEnd}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
                Apply
            </button>
        </div>
    );
}

function HighlightCard({ title, detail, tone }: { title: string; detail: string; tone: 'good' | 'warn' | 'neutral' }) {
    const toneClass =
        tone === 'good'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100'
            : tone === 'warn'
              ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100'
              : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100';

    const iconClass =
        tone === 'good'
            ? 'text-emerald-600 dark:text-emerald-400'
            : tone === 'warn'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-slate-400 dark:text-slate-500';

    return (
        <div className={`rounded-lg border px-4 py-3 ${toneClass}`}>
            <div className="flex items-start gap-3">
                {tone === 'good' ? (
                    <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${iconClass}`} />
                ) : tone === 'warn' ? (
                    <TrendingUp className={`h-5 w-5 flex-shrink-0 ${iconClass}`} />
                ) : (
                    <BarChart2 className={`h-5 w-5 flex-shrink-0 ${iconClass}`} />
                )}
                <div className="flex-1">
                    <p className="font-medium">{title}</p>
                    <p className="mt-1 text-xs opacity-90">{detail}</p>
                </div>
            </div>
        </div>
    );
}

function BreakdownComparisonTable({ current, previous }: { current: MonthStats; previous: MonthStats }) {
    const rows = compareCodes(current, previous);

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-200 dark:border-white/10">
                        <th className="px-3 py-2 text-left font-semibold text-slate-900 dark:text-white">Code</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">Current Count</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">Current %</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">Previous Count</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">Δ Count</th>
                        <th className="px-3 py-2 text-right font-semibold text-slate-900 dark:text-white">Δ %pts</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.code} className="border-b border-slate-100 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5">
                            <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                                <span
                                    className="inline-block h-2 w-2 rounded-full mr-2"
                                    style={{ backgroundColor: CODE_COLORS[row.code] || '#cbd5e1' }}
                                />
                                {row.display}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{row.currentCount.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{pct(row.currentShare)}</td>
                            <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-500">{row.previousCount.toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right font-medium ${row.deltaCount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {row.deltaCount >= 0 ? '+' : ''}{row.deltaCount.toLocaleString()}
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${row.deltaShare >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {row.deltaShare >= 0 ? '+' : ''}{row.deltaShare.toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TopFaqList({ items }: { items: FAQEnquiryItem[] }) {
    return (
        <div className="space-y-2">
            {items.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">No FAQ data available for this period.</p>
            ) : (
                items.map((item, idx) => (
                    <div key={item.code} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/5">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500">#{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white truncate">{item.name || item.code}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{item.count.toLocaleString()} enquiries</p>
                        </div>
                        <div className="text-right">
                            <p className="font-semibold text-slate-900 dark:text-white">{pct(item.percentage)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">of top 5</p>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

export function FAQMonthlyReport({ report, error }: Props) {
    useTheme(); // Access theme

    if (error) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                <p className="text-sm font-medium text-red-900 dark:text-red-100">Failed to load FAQ report</p>
                <p className="mt-1 text-xs text-red-800 dark:text-red-200">{error}</p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-center">
                    <Eye className="mx-auto h-8 w-8 text-slate-400" />
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading report...</p>
                </div>
            </div>
        );
    }

    const highlights = buildHighlights(report);
    const { current, previous } = report;

    return (
        <div className="space-y-8">
            {/* Date Range Controls */}
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white">FAQ Analyst Report</h1>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Analyze FAQ performance by period</p>
                </div>
                <DateRangeControls startDate={current.start_date} endDate={current.end_date} />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    label="Total Interactions"
                    value={current.grand_total.toLocaleString()}
                    delta={formatCountDelta(current.grand_total, previous.grand_total)}
                    icon={<BarChart2 className="h-4 w-4" />}
                />
                <KpiCard
                    label="Unique Visitors"
                    value={current.unique_visitors.toLocaleString()}
                    delta={formatCountDelta(current.unique_visitors, previous.unique_visitors)}
                    icon={<Users className="h-4 w-4" />}
                />
                <KpiCard
                    label="FAQ Resolution Rate"
                    value={pct(current.faq_resolution_rate)}
                    delta={formatRateDelta(current.faq_resolution_rate, previous.faq_resolution_rate)}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <KpiCard
                    label="Human Escalation Rate"
                    value={pct(current.human_escalation_rate)}
                    delta={formatRateDelta(current.human_escalation_rate, previous.human_escalation_rate, true)}
                    icon={<PhoneCall className="h-4 w-4" />}
                />
            </div>

            {/* Highlights */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {highlights.map((h, idx) => (
                    <HighlightCard key={idx} {...h} />
                ))}
            </div>

            {/* Donut Charts */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <DonutCard
                    title={`Review Code Breakdown — Current`}
                    subtitle={current.label}
                    data={current.breakdown.map((item) => ({
                        name: item.display,
                        value: item.count,
                        color: CODE_COLORS[item.code] || '#94a3b8',
                    }))}
                    height={350}
                />
                <DonutCard
                    title={`Review Code Breakdown — Previous`}
                    subtitle={previous.label}
                    data={previous.breakdown.map((item) => ({
                        name: item.display,
                        value: item.count,
                        color: CODE_COLORS[item.code] || '#94a3b8',
                    }))}
                    height={350}
                />
            </div>

            {/* Code Comparison Table */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <SectionTitle title="Code Comparison by Period" />
                <div className="mt-4">
                    <BreakdownComparisonTable current={current} previous={previous} />
                </div>
            </div>

            {/* Top 5 FAQ */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
                <SectionTitle title="Top 5 FAQ Enquiries" tooltip="Based on ai_ci codes with service catalog names, excluding NA-coded interactions." />
                <div className="mt-4">
                    <TopFaqList items={report.top5_faq} />
                </div>
            </div>

            {/* Operational Guidance */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5">
                <SectionTitle title="Operational Guidance" />
                <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                    <p>
                        <strong className="text-slate-700 dark:text-slate-300">Outcome Quality:</strong> Higher ACCT rates and lower ERR rates indicate good FAQ content
                        quality. IMP codes suggest room for optimization.
                    </p>
                    <p>
                        <strong className="text-slate-700 dark:text-slate-300">Focus Areas:</strong> Monitor human escalation rate—high transfer sessions may indicate
                        questions outside FAQ scope or complex scenarios requiring human intervention.
                    </p>
                    <p>
                        <strong className="text-slate-700 dark:text-slate-300">NA Share:</strong> A large NA share suggests incoming traffic doesn&apos;t match FAQ patterns. Review
                        the top-5 FAQ list to identify demand trends and potential new content areas.
                    </p>
                </div>
            </div>
        </div>
    );
}
