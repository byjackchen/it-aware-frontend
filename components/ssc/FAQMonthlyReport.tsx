'use client';

/**
 * FAQMonthlyReport — Analytics dashboard for FAQ chatbot performance.
 *
 * Styled to match the Active Monitoring Hub pattern with KPI cards,
 * charts (donut, bar), comparison table, and highlight cards.
 * Data comes from the /report/faq-monthly backend endpoint.
 */

import { useCallback, useState } from 'react';
import {
    ArrowRight,
    BarChart2,
    CheckCircle2,
    Eye,
    HelpCircle,
    MessageCircle,
    PhoneCall,
    TrendingDown,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTheme } from '@/lib/contexts/theme-context';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { GroupBarCard } from '@/components/ops_dashboard/GroupBarCard';
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
    NEW: '#8b5cf6',
    CUST: '#06b6d4',
    OOS: '#ec4899',
};

function pct(value: number): string {
    return `${value.toFixed(1)}%`;
}

function formatCountDelta(current: number, previous: number): { value: string; trend: 'up' | 'down' | 'flat' } {
    const diff = current - previous;
    if (diff === 0) return { value: 'Flat vs prev', trend: 'flat' };
    return {
        value: `${diff > 0 ? '+' : ''}${diff.toLocaleString()} vs prev`,
        trend: diff > 0 ? 'up' : 'down',
    };
}

function formatRateDelta(current: number, previous: number, lowerIsBetter = false): { value: string; trend: 'up' | 'down' | 'flat' } {
    const diff = Number((current - previous).toFixed(2));
    if (diff === 0) return { value: 'Flat vs prev', trend: 'flat' };
    const improved = lowerIsBetter ? diff < 0 : diff > 0;
    return {
        value: `${diff > 0 ? '+' : ''}${diff.toFixed(1)} pts`,
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
            detail: `${pct(current.faq_resolution_rate)} this period, ${resolutionDiff >= 0 ? '+' : ''}${resolutionDiff.toFixed(1)} pts vs previous.`,
            tone: resolutionDiff >= 0 ? 'good' : 'warn',
        },
        {
            title: escalationDiff <= 0 ? 'Human handoff contained' : 'Handoff pressure rising',
            detail: `${pct(current.human_escalation_rate)} of sessions reached a human, ${escalationDiff >= 0 ? '+' : ''}${escalationDiff.toFixed(1)} pts vs previous.`,
            tone: escalationDiff <= 0 ? 'good' : 'warn',
        },
        {
            title: naShare >= 20 ? 'High non-FAQ traffic' : 'Most traffic looks FAQ-relevant',
            detail: `NA share is ${pct(naShare)}. ACCT share of all traffic is ${pct(acctShare)}.`,
            tone: naShare >= 20 ? 'warn' : 'neutral',
        },
        {
            title: topFaq ? `Top demand: ${topFaq.name}` : 'No top FAQ data',
            detail: topFaq
                ? `${topFaq.count.toLocaleString()} enquiries, ${pct(topFaq.percentage)} of top-5 demand.`
                : 'No catalog-linked FAQ enquiries were returned for this period.',
            tone: topFaq ? 'neutral' : 'warn',
        },
    ];
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
    return (
        <span className="group relative inline-flex items-center">
            <HelpCircle className="h-3.5 w-3.5 text-gray-400 transition-colors group-hover:text-white" />
            <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-[11px] leading-5 text-gray-300 shadow-lg group-hover:block">
                {text}
            </span>
        </span>
    );
}

function SectionHeading({ title, subtitle, tooltip, isLight }: { title: string; subtitle?: string; tooltip?: string; isLight: boolean }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <div>
                <div className="flex items-center gap-2">
                    <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{title}</h2>
                    {tooltip ? <Tooltip text={tooltip} /> : null}
                </div>
                {subtitle ? <p className={`mt-0.5 text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{subtitle}</p> : null}
            </div>
        </div>
    );
}

function DateRangeControls({ startDate, endDate }: { startDate: string; endDate: string }) {
    const router = useTransitionRouter();
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
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
            />
            <ArrowRight className="h-4 w-4 text-gray-500" />
            <input
                type="date"
                value={draftEnd}
                min={draftStart}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
            />
            <button
                type="button"
                onClick={apply}
                disabled={!draftStart || !draftEnd || draftStart > draftEnd}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
                Apply
            </button>
        </div>
    );
}

function HighlightCard({ title, detail, tone, isLight }: { title: string; detail: string; tone: 'good' | 'warn' | 'neutral'; isLight: boolean }) {
    const config = {
        good: {
            border: isLight ? 'border-emerald-200' : 'border-emerald-500/30',
            bg: isLight ? 'bg-emerald-50' : 'bg-emerald-500/10',
            title: isLight ? 'text-emerald-800' : 'text-emerald-300',
            detail: isLight ? 'text-emerald-700' : 'text-emerald-400',
            icon: isLight ? 'text-emerald-600' : 'text-emerald-400',
        },
        warn: {
            border: isLight ? 'border-amber-200' : 'border-amber-500/30',
            bg: isLight ? 'bg-amber-50' : 'bg-amber-500/10',
            title: isLight ? 'text-amber-800' : 'text-amber-300',
            detail: isLight ? 'text-amber-700' : 'text-amber-400',
            icon: isLight ? 'text-amber-600' : 'text-amber-400',
        },
        neutral: {
            border: isLight ? 'border-slate-200' : 'border-white/10',
            bg: isLight ? 'bg-slate-50' : 'bg-white/5',
            title: isLight ? 'text-slate-800' : 'text-gray-200',
            detail: isLight ? 'text-slate-600' : 'text-gray-400',
            icon: isLight ? 'text-slate-500' : 'text-gray-500',
        },
    }[tone];

    return (
        <div className={`rounded-xl border px-4 py-3 ${config.border} ${config.bg}`}>
            <div className="flex items-start gap-3">
                {tone === 'good' ? (
                    <CheckCircle2 className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.icon}`} />
                ) : tone === 'warn' ? (
                    <TrendingUp className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.icon}`} />
                ) : (
                    <BarChart2 className={`h-5 w-5 flex-shrink-0 mt-0.5 ${config.icon}`} />
                )}
                <div className="flex-1">
                    <p className={`text-sm font-semibold ${config.title}`}>{title}</p>
                    <p className={`mt-0.5 text-xs ${config.detail}`}>{detail}</p>
                </div>
            </div>
        </div>
    );
}

function BreakdownComparisonTable({ current, previous, isLight }: { current: MonthStats; previous: MonthStats; isLight: boolean }) {
    const rows = compareCodes(current, previous);
    const headerCls = `px-3 py-2.5 text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-gray-400'}`;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className={`border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                        <th className={`${headerCls} text-left`}>Code</th>
                        <th className={`${headerCls} text-right`}>Current</th>
                        <th className={`${headerCls} text-right`}>Share</th>
                        <th className={`${headerCls} text-right`}>Previous</th>
                        <th className={`${headerCls} text-right`}>&Delta; Count</th>
                        <th className={`${headerCls} text-right`}>&Delta; %pts</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.code} className={`border-b transition-colors ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/5 hover:bg-white/5'}`}>
                            <td className="px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                    <span
                                        className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: CODE_COLORS[row.code] || '#cbd5e1' }}
                                    />
                                    <span className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{row.display}</span>
                                </div>
                            </td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{row.currentCount.toLocaleString()}</td>
                            <td className={`px-3 py-2.5 text-right ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{pct(row.currentShare)}</td>
                            <td className={`px-3 py-2.5 text-right ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{row.previousCount.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-right">
                                <span className={`inline-flex items-center gap-1 text-sm font-medium ${row.deltaCount > 0 ? 'text-emerald-500' : row.deltaCount < 0 ? 'text-rose-500' : isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {row.deltaCount > 0 ? <TrendingUp className="h-3 w-3" /> : row.deltaCount < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                    {row.deltaCount >= 0 ? '+' : ''}{row.deltaCount.toLocaleString()}
                                </span>
                            </td>
                            <td className={`px-3 py-2.5 text-right text-sm font-medium ${row.deltaShare > 0 ? 'text-emerald-500' : row.deltaShare < 0 ? 'text-rose-500' : isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {row.deltaShare >= 0 ? '+' : ''}{row.deltaShare.toFixed(1)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TopFaqList({ items, isLight }: { items: FAQEnquiryItem[]; isLight: boolean }) {
    if (items.length === 0) {
        return <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>No FAQ data available for this period.</p>;
    }

    const maxCount = items[0]?.count ?? 1;
    const medalColors = [
        isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-300',
        isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-gray-300',
        isLight ? 'bg-orange-100 text-orange-700' : 'bg-orange-500/20 text-orange-300',
    ];
    const defaultBadge = isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-gray-400';

    return (
        <div className="space-y-2">
            {items.map((item, idx) => (
                <div key={item.code} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                    isLight
                        ? 'border-slate-200 bg-white hover:bg-slate-50'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                }`}>
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold flex-shrink-0 ${
                        medalColors[idx] ?? defaultBadge
                    }`}>
                        {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.name || item.code}</p>
                        {item.sample_question && (
                            <p className={`mt-0.5 text-xs truncate ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                &ldquo;{item.sample_question}&rdquo;
                            </p>
                        )}
                        <div className={`mt-1.5 h-1.5 w-full rounded-full ${isLight ? 'bg-slate-100' : 'bg-white/10'}`}>
                            <div
                                className="h-full rounded-full bg-blue-500"
                                style={{ width: `${Math.max(4, (item.count / maxCount) * 100)}%` }}
                            />
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                        <p className={`text-sm font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.count.toLocaleString()}</p>
                        <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{pct(item.percentage)}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function FAQMonthlyReport({ report, error }: Props) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    if (error) {
        return (
            <div className={`rounded-xl border p-6 ${isLight ? 'border-red-200 bg-red-50' : 'border-red-500/20 bg-red-500/10'}`}>
                <p className={`text-sm font-medium ${isLight ? 'text-red-900' : 'text-red-200'}`}>Failed to load FAQ report</p>
                <p className={`mt-1 text-xs ${isLight ? 'text-red-700' : 'text-red-300'}`}>{error}</p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-center">
                    <Eye className="mx-auto h-8 w-8 text-gray-500 animate-pulse" />
                    <p className="mt-3 text-sm text-gray-400">Loading report...</p>
                </div>
            </div>
        );
    }

    const highlights = buildHighlights(report);
    const { current, previous } = report;

    const sectionBg = isLight
        ? 'rounded-xl border border-slate-200 bg-white'
        : 'rounded-xl border border-white/10 bg-white/[0.03]';

    // Build bar chart data for top FAQ categories
    const topFaqBarData = report.top5_faq.map((item) => ({
        key: item.name || item.code,
        count: item.count,
        items: [],
    }));

    return (
        <div className="space-y-4">
            {/* Header + Date Controls */}
            <div className={`flex items-center justify-between p-4 ${sectionBg}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400'
                    }`}>
                        <BarChart2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>FAQ Analyst Report</h1>
                        <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            {current.label} vs {previous.label}
                        </p>
                    </div>
                </div>
                <DateRangeControls startDate={current.start_date} endDate={current.end_date} />
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label="Total Interactions"
                    value={current.grand_total.toLocaleString()}
                    delta={formatCountDelta(current.grand_total, previous.grand_total)}
                    icon={MessageCircle}
                />
                <KpiCard
                    label="Unique Visitors"
                    value={current.unique_visitors.toLocaleString()}
                    delta={formatCountDelta(current.unique_visitors, previous.unique_visitors)}
                    icon={Users}
                />
                <KpiCard
                    label="FAQ Resolution Rate"
                    value={pct(current.faq_resolution_rate)}
                    delta={formatRateDelta(current.faq_resolution_rate, previous.faq_resolution_rate)}
                    icon={CheckCircle2}
                />
                <KpiCard
                    label="Human Escalation Rate"
                    value={pct(current.human_escalation_rate)}
                    delta={formatRateDelta(current.human_escalation_rate, previous.human_escalation_rate, true)}
                    icon={PhoneCall}
                />
            </div>

            {/* Highlights */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {highlights.map((h, idx) => (
                    <HighlightCard key={idx} {...h} isLight={isLight} />
                ))}
            </div>

            {/* Charts: 2 Donuts + Top FAQ bar */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <DonutCard
                    title="Review Code — Current"
                    subtitle={current.label}
                    data={current.breakdown.filter((item) => item.code !== 'NA').map((item) => ({
                        name: item.display,
                        value: item.count,
                        color: CODE_COLORS[item.code] || '#94a3b8',
                    }))}
                    height={350}
                />
                <DonutCard
                    title="Review Code — Previous"
                    subtitle={previous.label}
                    data={previous.breakdown.filter((item) => item.code !== 'NA').map((item) => ({
                        name: item.display,
                        value: item.count,
                        color: CODE_COLORS[item.code] || '#94a3b8',
                    }))}
                    height={350}
                />
            </div>

            {/* Top FAQ bar chart — full width so labels aren't truncated */}
            <GroupBarCard
                title="Top FAQ Categories"
                subtitle="Most queried service items"
                data={topFaqBarData}
                topN={5}
                color={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']}
            />

            {/* Code Comparison Table */}
            <div className={`p-4 ${sectionBg}`}>
                <SectionHeading
                    title="Code Comparison by Period"
                    subtitle="Current vs previous period breakdown with deltas"
                    isLight={isLight}
                />
                <div className="mt-4">
                    <BreakdownComparisonTable current={current} previous={previous} isLight={isLight} />
                </div>
            </div>

            {/* Top 5 FAQ detail list */}
            <div className={`p-4 ${sectionBg}`}>
                <SectionHeading
                    title="Top 5 FAQ Enquiries"
                    tooltip="Based on ai_ci codes with service catalog names, excluding NA-coded interactions."
                    isLight={isLight}
                />
                <div className="mt-4">
                    <TopFaqList items={report.top5_faq} isLight={isLight} />
                </div>
            </div>

            {/* Operational Guidance */}
            <div className={`p-4 ${sectionBg}`}>
                <SectionHeading title="Operational Guidance" isLight={isLight} />
                <div className={`mt-3 space-y-3 text-xs ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                    <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500 mt-0.5" />
                        <p>
                            <strong className={isLight ? 'text-slate-700' : 'text-white'}>Outcome Quality:</strong> Higher ACCT rates and lower ERR rates indicate good FAQ content
                            quality. IMP codes suggest room for optimization.
                        </p>
                    </div>
                    <div className="flex items-start gap-2">
                        <PhoneCall className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
                        <p>
                            <strong className={isLight ? 'text-slate-700' : 'text-white'}>Focus Areas:</strong> Monitor human escalation rate — high transfer sessions may indicate
                            questions outside FAQ scope or complex scenarios requiring human intervention.
                        </p>
                    </div>
                    <div className="flex items-start gap-2">
                        <HelpCircle className="h-4 w-4 flex-shrink-0 text-blue-500 mt-0.5" />
                        <p>
                            <strong className={isLight ? 'text-slate-700' : 'text-white'}>NA Share:</strong> A large NA share suggests incoming traffic doesn&apos;t match FAQ patterns. Review
                            the top-5 FAQ list to identify demand trends and potential new content areas.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
