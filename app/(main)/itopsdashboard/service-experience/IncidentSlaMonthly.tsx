'use client';

/**
 * IncidentSlaMonthly — ITOps Dashboard monthly incident SLA table.
 *
 * Layout mirrors the oitops monthly SLA report: one row per month of the
 * year plus a full-year cumulative row; columns are response SLA,
 * per-priority resolution SLAs (each with a sample count), subtotals, and
 * total samples. Data comes from the
 * /dashboards/itopsdashboard/incident-sla-monthly backend endpoint.
 */

import { useTranslations } from 'next-intl';
import { AlertTriangle, Gauge } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { IncidentSlaCell, IncidentSlaMonthRow, IncidentSlaMonthlyReportData } from '@/lib/types/objects';

interface Props {
    report: IncidentSlaMonthlyReportData | null;
    error: string | null;
}

function pctText(cell: IncidentSlaCell): string {
    return cell.pct === null ? '—' : `${cell.pct.toFixed(1)}%`;
}

export function IncidentSlaMonthly({ report, error }: Props) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const t = useTranslations('ItopsDashboard');

    if (error) {
        return (
            <div className={`rounded-xl border p-6 ${isLight ? 'border-red-200 bg-red-50' : 'border-red-500/20 bg-red-500/10'}`}>
                <p className={`text-sm font-medium ${isLight ? 'text-red-900' : 'text-red-200'}`}>{t('error.title')}</p>
                <p className={`mt-1 text-xs ${isLight ? 'text-red-700' : 'text-red-300'}`}>{error}</p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="text-center">
                    <AlertTriangle className="mx-auto h-8 w-8 text-gray-500 animate-pulse" />
                    <p className="mt-3 text-sm text-gray-400">{t('error.loading')}</p>
                </div>
            </div>
        );
    }

    const generatedDay = Number.parseInt(report.generated_at.slice(8, 10), 10);
    const monthLabel = (row: IncidentSlaMonthRow) =>
        row.is_partial ? `${row.month}${t('asOfDay', { day: generatedDay })}` : row.month;

    const sectionBg = isLight
        ? 'rounded-xl border border-slate-200 bg-white'
        : 'rounded-xl border border-white/10 bg-white/[0.03]';
    const headerCls = `px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${isLight ? 'text-slate-500' : 'text-gray-400'}`;
    const pctCls = `px-3 py-2.5 text-right whitespace-nowrap font-medium ${isLight ? 'text-slate-800' : 'text-gray-100'}`;
    const countCls = `px-3 py-2.5 text-right whitespace-nowrap ${isLight ? 'text-slate-500' : 'text-gray-400'}`;

    const headers = [
        t('columns.month'),
        t('columns.responseSla'),
        t('columns.sample'),
        t('columns.p1'),
        t('columns.sample'),
        t('columns.p2'),
        t('columns.sample'),
        t('columns.p3'),
        t('columns.sample'),
        t('columns.p4'),
        t('columns.sample'),
        t('columns.resolutionSubtotal'),
        t('columns.allSla'),
        t('columns.totalSamples'),
    ];

    // month column excluded: 5 pct/sample pairs + subtotal + all-SLA + total samples
    const valueCells = (row: IncidentSlaMonthRow): { text: string; isPct: boolean }[] => [
        { text: pctText(row.response), isPct: true },
        { text: row.response.total.toLocaleString(), isPct: false },
        { text: pctText(row.p1), isPct: true },
        { text: row.p1.total.toLocaleString(), isPct: false },
        { text: pctText(row.p2), isPct: true },
        { text: row.p2.total.toLocaleString(), isPct: false },
        { text: pctText(row.p3), isPct: true },
        { text: row.p3.total.toLocaleString(), isPct: false },
        { text: pctText(row.p4), isPct: true },
        { text: row.p4.total.toLocaleString(), isPct: false },
        { text: pctText(row.resolution_subtotal), isPct: true },
        { text: pctText(row.all_sla), isPct: true },
        { text: row.all_sla.total.toLocaleString(), isPct: false },
    ];

    // Year-to-date headline figures, straight off the cumulative row — the same
    // numbers the overview page shows for sla / overall_sla / response_sla.
    const kpis: { label: string; cell: IncidentSlaCell; showTotal?: boolean }[] = [
        { label: t('kpi.allSla'), cell: report.cumulative.all_sla, showTotal: true },
        { label: t('kpi.responseSla'), cell: report.cumulative.response, showTotal: true },
        { label: t('kpi.resolutionSla'), cell: report.cumulative.resolution_subtotal, showTotal: true },
    ];

    return (
        <div className="space-y-4">
            <div className={`flex items-center justify-between p-4 ${sectionBg}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                        <Gauge className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-lg font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('domainTitle')}</h1>
                        <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('domainSubtitle', { year: report.year })}</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {kpis.map((k) => (
                    <div key={k.label} className={`p-4 ${sectionBg}`}>
                        <p className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{k.label}</p>
                        <p className={`mt-1 text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {pctText(k.cell)}
                        </p>
                        {k.showTotal && (
                            <p className={`mt-0.5 text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                {t('kpi.samples', { total: k.cell.total })}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            <div className={`p-4 ${sectionBg}`}>
                <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('title')}</h2>
                <p className={`mt-0.5 text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('subtitle', { year: report.year })}</p>
            </div>

            <div className={`p-4 ${sectionBg}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={`border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                                {headers.map((label, idx) => (
                                    <th key={`${label}-${idx}`} className={`${headerCls} ${idx === 0 ? 'text-left' : 'text-right'}`}>
                                        {label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {report.months.map((row) => (
                                <tr key={row.month} className={`border-b transition-colors ${isLight ? 'border-slate-100 hover:bg-slate-50' : 'border-white/5 hover:bg-white/5'}`}>
                                    <td className={`px-3 py-2.5 whitespace-nowrap font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{monthLabel(row)}</td>
                                    {valueCells(row).map((cell, idx) => (
                                        <td key={idx} className={cell.isPct ? pctCls : countCls}>{cell.text}</td>
                                    ))}
                                </tr>
                            ))}
                            <tr className={isLight ? 'bg-slate-50' : 'bg-white/[0.04]'}>
                                <td className={`px-3 py-2.5 whitespace-nowrap font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                    {t('yearCumulative', { year: report.year })}
                                </td>
                                {valueCells(report.cumulative).map((cell, idx) => (
                                    <td key={idx} className={`${cell.isPct ? pctCls : countCls} font-semibold`}>{cell.text}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
