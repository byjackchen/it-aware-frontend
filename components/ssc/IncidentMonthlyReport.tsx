'use client';

/**
 * IncidentMonthlyReport — Analytics dashboard for incident classification.
 *
 * Styled to match the FAQ Monthly Report pattern with KPI cards,
 * donut charts (AI category distribution), comparison table, and top-5 lists.
 * Data comes from the /report/incident-monthly backend endpoint.
 */

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Clock,
    HelpCircle,
    TrendingDown,
    TrendingUp,
    Flame,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTheme } from '@/lib/contexts/theme-context';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import type { IncidentCategoryBreakdownItem, IncidentMonthlyReportData, IncidentMonthStats, IncidentTop5Item, ChatbotEscalationStats } from '@/lib/types/objects';

interface Props {
    report: IncidentMonthlyReportData | null;
    error: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
    KB_GAP: '#22c55e',
    USER_HABIT: '#f59e0b',
    AGENT_ERR: '#ef4444',
    MANUAL_SSC: '#3b82f6',
    ONSITE: '#8b5cf6',
    SECURITY: '#06b6d4',
    MONITORING: '#ec4899',
    OUT_OF_SCOPE: '#94a3b8',
};

const STATE_COLORS: Record<string, string> = {
    New: '#3b82f6',
    'In Progress': '#f59e0b',
    'On Hold': '#8b5cf6',
    Resolved: '#22c55e',
    Closed: '#6b7280',
};

const PRIORITY_COLORS: Record<string, string> = {
    '1': '#ef4444',
    '2': '#f97316',
    '3': '#f59e0b',
    '4': '#22c55e',
    Critical: '#ef4444',
    High: '#f97316',
    Medium: '#f59e0b',
    Low: '#22c55e',
    Unknown: '#94a3b8',
};

const PRIORITY_LABELS: Record<string, string> = {
    '1': '1 - Critical',
    '2': '2 - High',
    '3': '3 - Medium',
    '4': '4 - Low',
    Critical: 'Critical',
    High: 'High',
    Medium: 'Medium',
    Low: 'Low',
    Unknown: 'Unknown',
};

const CATEGORY_LABELS: Record<string, string> = {
    KB_GAP: 'KB Gap',
    USER_HABIT: 'User Habit',
    AGENT_ERR: 'Agent Error',
    MANUAL_SSC: 'Manual SSC',
    ONSITE: 'Onsite',
    SECURITY: 'Security',
    MONITORING: 'Monitoring',
    OUT_OF_SCOPE: 'Out of Scope',
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

function formatCountDeltaInverse(current: number, previous: number): { value: string; trend: 'up' | 'down' | 'flat' } {
    const diff = current - previous;
    if (diff === 0) return { value: 'Flat vs prev', trend: 'flat' };
    // Lower is better for this metric
    return {
        value: `${diff > 0 ? '+' : ''}${diff.toLocaleString()} vs prev`,
        trend: diff < 0 ? 'up' : 'down',
    };
}

function codeCount(stats: IncidentMonthStats, code: string): number {
    return stats.breakdown.find((item) => item.code === code)?.count ?? 0;
}

function codeShare(stats: IncidentMonthStats, code: string): number {
    return stats.breakdown.find((item) => item.code === code)?.percentage ?? 0;
}

function compareCodes(current: IncidentMonthStats, previous: IncidentMonthStats) {
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
                display: CATEGORY_LABELS[code] || display,
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

function BreakdownComparisonTable({ current, previous, isLight }: { current: IncidentMonthStats; previous: IncidentMonthStats; isLight: boolean }) {
    const rows = compareCodes(current, previous);
    const headerCls = `px-3 py-2.5 text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-slate-500' : 'text-gray-400'}`;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className={`border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                        <th className={`${headerCls} text-left`}>Category</th>
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
                                        style={{ backgroundColor: CATEGORY_COLORS[row.code] || '#cbd5e1' }}
                                    />
                                    <span className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{row.display}</span>
                                </div>
                            </td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{row.currentCount.toLocaleString()}</td>
                            <td className={`px-3 py-2.5 text-right ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{pct(row.currentShare)}</td>
                            <td className={`px-3 py-2.5 text-right ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{row.previousCount.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-right">
                                <span className={`inline-flex items-center gap-1 text-sm font-medium ${row.deltaCount > 0 ? 'text-rose-500' : row.deltaCount < 0 ? 'text-emerald-500' : isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {row.deltaCount > 0 ? <TrendingUp className="h-3 w-3" /> : row.deltaCount < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                    {row.deltaCount >= 0 ? '+' : ''}{row.deltaCount.toLocaleString()}
                                </span>
                            </td>
                            <td className={`px-3 py-2.5 text-right text-sm font-medium ${row.deltaShare > 0 ? 'text-rose-500' : row.deltaShare < 0 ? 'text-emerald-500' : isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {row.deltaShare >= 0 ? '+' : ''}{row.deltaShare.toFixed(1)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Top5List({ items, title, isLight }: { items: IncidentTop5Item[]; title: string; isLight: boolean }) {
    if (items.length === 0) {
        return <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>No data available for this period.</p>;
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
                <div key={item.name} className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
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
                        <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{item.name}</p>
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

// ── Chatbot Escalation Section ──────────────────────────────────────────────

function ChatbotEscalationSection({
    current,
    previous,
    isLight,
    sectionBg,
}: {
    current: ChatbotEscalationStats;
    previous: ChatbotEscalationStats | null;
    isLight: boolean;
    sectionBg: string;
}) {
    const prevEscRate = previous?.escalation_rate ?? 0;
    const prevBotRate = previous?.bot_handled_rate ?? 0;
    const prevAdjRate = previous?.adjusted_bot_failure_rate ?? 0;

    function rateDelta(cur: number, prev: number, lowerIsBetter = false): { value: string; trend: 'up' | 'down' | 'flat' } {
        const diff = cur - prev;
        if (Math.abs(diff) < 0.1) return { value: 'Flat vs prev', trend: 'flat' };
        const sign = diff > 0 ? '+' : '';
        const trend = lowerIsBetter ? (diff < 0 ? 'up' : 'down') : (diff > 0 ? 'up' : 'down');
        return { value: `${sign}${diff.toFixed(1)}pp vs prev`, trend };
    }

    return (
        <div className={`p-4 ${sectionBg}`}>
            <SectionHeading
                title="Chatbot Escalation Metrics"
                subtitle={`${current.label} — ${current.meaningful_sessions} meaningful sessions`}
                tooltip="Session = same user's interactions grouped by 15-min inactivity gap. Escalation = user confirmed transfer to human agent (agentsupport-confirm)."
                isLight={isLight}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <KpiCard
                    label="Escalation Rate"
                    value={`${current.escalation_rate.toFixed(1)}%`}
                    delta={rateDelta(current.escalation_rate, prevEscRate, true)}
                    icon={AlertTriangle}
                    tooltip="Sessions with agentsupport-confirm ÷ meaningful sessions"
                />
                <KpiCard
                    label="Bot Handled Rate"
                    value={`${current.bot_handled_rate.toFixed(1)}%`}
                    delta={rateDelta(current.bot_handled_rate, prevBotRate)}
                    icon={CheckCircle2}
                    tooltip="Sessions with queries/clicks but no escalation ÷ meaningful sessions"
                />
                <KpiCard
                    label="Adjusted Bot Failure"
                    value={`${current.adjusted_bot_failure_rate.toFixed(1)}%`}
                    delta={rateDelta(current.adjusted_bot_failure_rate, prevAdjRate, true)}
                    icon={TrendingDown}
                    tooltip="(escalated - direct) ÷ (meaningful - direct). Excludes users who never tried the bot."
                />
                <KpiCard
                    label="Avg Steps to Escalate"
                    value={current.avg_interactions_before_escalation.toFixed(1)}
                    delta={{
                        value: `${current.repeat_escalator_count} repeat users`,
                        trend: 'flat',
                    }}
                    icon={ArrowRight}
                    tooltip="Average non-enter_chat interactions before user confirms escalation"
                />
            </div>
            {/* Breakdown row */}
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className={`rounded-lg p-3 ${isLight ? 'bg-white border border-slate-200' : 'bg-white/5 border border-white/5'}`}>
                    <p className={`text-[11px] font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Escalated Sessions</p>
                    <p className={`mt-1 text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{current.escalated_sessions}</p>
                </div>
                <div className={`rounded-lg p-3 ${isLight ? 'bg-white border border-slate-200' : 'bg-white/5 border border-white/5'}`}>
                    <p className={`text-[11px] font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Direct (skipped bot)</p>
                    <p className={`mt-1 text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {current.direct_escalation_sessions}
                        <span className={`ml-1 text-xs font-normal ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                            ({current.direct_escalation_rate.toFixed(0)}%)
                        </span>
                    </p>
                </div>
                <div className={`rounded-lg p-3 ${isLight ? 'bg-white border border-slate-200' : 'bg-white/5 border border-white/5'}`}>
                    <p className={`text-[11px] font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>After Trying Bot</p>
                    <p className={`mt-1 text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {current.after_bot_escalation_sessions}
                        <span className={`ml-1 text-xs font-normal ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                            ({current.after_bot_rate.toFixed(0)}%)
                        </span>
                    </p>
                </div>
                <div className={`rounded-lg p-3 ${isLight ? 'bg-white border border-slate-200' : 'bg-white/5 border border-white/5'}`}>
                    <p className={`text-[11px] font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Repeat Escalators</p>
                    <p className={`mt-1 text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{current.repeat_escalator_count}</p>
                </div>
            </div>
            {/* Donut: escalation breakdown */}
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <DonutCard
                    title="Session Outcome — Current"
                    subtitle={current.label}
                    data={[
                        { name: 'Bot Handled', value: current.bot_handled_sessions, color: '#22c55e' },
                        { name: 'Direct Escalation', value: current.direct_escalation_sessions, color: '#f59e0b' },
                        { name: 'After-Bot Escalation', value: current.after_bot_escalation_sessions, color: '#ef4444' },
                    ]}
                    height={280}
                />
                {previous && (
                    <DonutCard
                        title="Session Outcome — Previous"
                        subtitle={previous.label}
                        data={[
                            { name: 'Bot Handled', value: previous.bot_handled_sessions, color: '#22c55e' },
                            { name: 'Direct Escalation', value: previous.direct_escalation_sessions, color: '#f59e0b' },
                            { name: 'After-Bot Escalation', value: previous.after_bot_escalation_sessions, color: '#ef4444' },
                        ]}
                        height={280}
                    />
                )}
            </div>
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function IncidentMonthlyReport({ report, error }: Props) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const t = useTranslations('SSCIncidentReport');

    if (error) {
        return (
            <div className={`rounded-xl border p-6 ${isLight ? 'border-red-200 bg-red-50' : 'border-red-500/20 bg-red-500/10'}`}>
                <p className={`text-sm font-medium ${isLight ? 'text-red-900' : 'text-red-200'}`}>Failed to load incident report</p>
                <p className={`mt-1 text-xs ${isLight ? 'text-red-700' : 'text-red-300'}`}>{error}</p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-center">
                    <AlertTriangle className="mx-auto h-8 w-8 text-gray-500 animate-pulse" />
                    <p className="mt-3 text-sm text-gray-400">Loading report...</p>
                </div>
            </div>
        );
    }

    const { current, previous } = report;

    const sectionBg = isLight
        ? 'rounded-xl border border-slate-200 bg-white'
        : 'rounded-xl border border-white/10 bg-white/[0.03]';

    return (
        <div className="space-y-4">
            {/* Header + Date Controls */}
            <div className={`flex items-center justify-between p-4 ${sectionBg}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isLight ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>Incident Monthly Report</h1>
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
                    label={t('kpi.totalIncidents')}
                    value={current.grand_total.toLocaleString()}
                    delta={formatCountDelta(current.grand_total, previous.grand_total)}
                    icon={AlertTriangle}
                    tooltip={t('kpiTooltip.totalIncidents')}
                />
                <KpiCard
                    label={t('kpi.resolved')}
                    value={current.resolved_count.toLocaleString()}
                    delta={formatCountDelta(current.resolved_count, previous.resolved_count)}
                    icon={CheckCircle2}
                    tooltip={t('kpiTooltip.resolved')}
                />
                <KpiCard
                    label={t('kpi.highPriority')}
                    value={current.high_priority_count.toLocaleString()}
                    delta={formatCountDeltaInverse(current.high_priority_count, previous.high_priority_count)}
                    icon={Flame}
                    tooltip={t('kpiTooltip.highPriority')}
                />
                <KpiCard
                    label={t('kpi.overdue')}
                    value={current.overdue_count.toLocaleString()}
                    delta={formatCountDeltaInverse(current.overdue_count, previous.overdue_count)}
                    icon={Clock}
                    tooltip={t('kpiTooltip.overdue')}
                />
            </div>

            {/* AI Category Distribution — Donut Charts */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <DonutCard
                    title="AI Category — Current"
                    subtitle={current.label}
                    data={current.breakdown.map((item) => ({
                        name: CATEGORY_LABELS[item.code] || item.display,
                        value: item.count,
                        color: CATEGORY_COLORS[item.code] || '#94a3b8',
                    }))}
                    height={350}
                />
                <DonutCard
                    title="AI Category — Previous"
                    subtitle={previous.label}
                    data={previous.breakdown.map((item) => ({
                        name: CATEGORY_LABELS[item.code] || item.display,
                        value: item.count,
                        color: CATEGORY_COLORS[item.code] || '#94a3b8',
                    }))}
                    height={350}
                />
            </div>

            {/* State + Priority Distribution */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <DonutCard
                    title="State Distribution"
                    subtitle={current.label}
                    data={current.state_breakdown.map((item) => ({
                        name: item.display,
                        value: item.count,
                        color: STATE_COLORS[item.code] || '#94a3b8',
                    }))}
                    height={300}
                />
                <DonutCard
                    title="Priority Distribution"
                    subtitle={current.label}
                    data={current.priority_breakdown.map((item) => ({
                        name: PRIORITY_LABELS[item.code] || item.display,
                        value: item.count,
                        color: PRIORITY_COLORS[item.code] || '#94a3b8',
                    }))}
                    height={300}
                />
            </div>

            {/* Category Comparison Table */}
            <div className={`p-4 ${sectionBg}`}>
                <SectionHeading
                    title="Category Comparison by Period"
                    subtitle="Current vs previous period breakdown with deltas"
                    tooltip="Based on COALESCE(review_category, ai_category). More incidents in a category may indicate rising issues."
                    isLight={isLight}
                />
                <div className="mt-4">
                    <BreakdownComparisonTable current={current} previous={previous} isLight={isLight} />
                </div>
            </div>

            {/* Top 5 Rankings — Side by Side */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className={`p-4 ${sectionBg}`}>
                    <SectionHeading
                        title="Top 5 Assigned Groups"
                        tooltip="Groups handling the most incidents in the current period."
                        isLight={isLight}
                    />
                    <div className="mt-4">
                        <Top5List items={report.top5_assigned_group} title="Assigned Group" isLight={isLight} />
                    </div>
                </div>
                <div className={`p-4 ${sectionBg}`}>
                    <SectionHeading
                        title="Top 5 Service Catalogs"
                        tooltip="Service catalog items with the most incidents in the current period."
                        isLight={isLight}
                    />
                    <div className="mt-4">
                        <Top5List items={report.top5_service_catalog} title="Service Catalog" isLight={isLight} />
                    </div>
                </div>
            </div>

            {/* Chatbot Escalation Metrics */}
            {report.chatbot_escalation && (
                <ChatbotEscalationSection
                    current={report.chatbot_escalation}
                    previous={report.chatbot_escalation_previous}
                    isLight={isLight}
                    sectionBg={sectionBg}
                />
            )}
        </div>
    );
}
