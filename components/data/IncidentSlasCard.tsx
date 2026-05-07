'use client';

/**
 * SLA table for the incident detail page.
 *
 * Each row is one ``task_sla`` record from ServiceNow — typically an
 * incident has two (response + resolution). Read-only: SN is the
 * authoritative source, upserts happen via the sync DAG.
 *
 * See backend docs/superpowers/plans/2026-04-24-ops-dashboard-phase-2-incident-slas.md.
 */

import type { IncidentSla } from '@/lib/types/objects';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

export interface IncidentSlasCardProps {
    slas: IncidentSla[];
}

function formatDuration(seconds: number | null): string {
    if (seconds === null || seconds === undefined) return '—';
    if (seconds === 0) return '0s';
    const abs = Math.abs(seconds);
    const days = Math.floor(abs / 86400);
    const hours = Math.floor((abs % 86400) / 3600);
    const mins = Math.floor((abs % 3600) / 60);
    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (mins && days === 0) parts.push(`${mins}m`);
    return parts.join(' ') || '<1m';
}

function formatPct(value: number | null): string {
    if (value === null || value === undefined) return '—';
    return `${Number(value).toFixed(2)}%`;
}

export function IncidentSlasCard({ slas }: IncidentSlasCardProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';

    const cardCls = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';
    const headerCls = isLight ? 'text-slate-800' : 'text-white';
    const tableHeadCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const rowBorderCls = isLight ? 'border-slate-100' : 'border-white/5';
    const mutedCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const pillCls = isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-200';

    const activePill = isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-500/15 text-blue-300';
    const breachedPill = isLight ? 'bg-red-50 text-red-700' : 'bg-red-500/15 text-red-300';
    const completedPill = isLight ? 'bg-green-50 text-green-700' : 'bg-green-500/15 text-green-300';

    const stagePill = (stage: string | null, breached: boolean | null, made: boolean | null) => {
        if (stage && stage.toLowerCase() === 'completed') {
            if (made) return { label: 'Completed · Made', cls: completedPill, Icon: CheckCircle2 };
            if (breached) return { label: 'Completed · Breached', cls: breachedPill, Icon: AlertTriangle };
            return { label: 'Completed', cls: pillCls, Icon: CheckCircle2 };
        }
        if (breached) {
            return { label: stage ?? 'Breached', cls: breachedPill, Icon: AlertTriangle };
        }
        return { label: stage ?? 'Unknown', cls: activePill, Icon: Clock };
    };

    if (!slas || slas.length === 0) {
        return (
            <div className={`rounded-xl border p-6 ${cardCls}`}>
                <div className="flex items-center justify-between mb-3">
                    <h2 className={`text-lg font-semibold ${headerCls}`}>ServiceNow SLAs</h2>
                    <span className={`text-xs px-2 py-1 rounded ${pillCls}`}>0 records</span>
                </div>
                <div className={`text-sm italic ${mutedCls}`}>
                    No SLA records yet. The sync DAG or the one-off backfill script populates
                    these from the ServiceNow <code>/get_incident_slas</code> endpoint.
                </div>
            </div>
        );
    }

    return (
        <div className={`rounded-xl border p-6 ${cardCls}`}>
            <div className="flex items-center justify-between mb-3">
                <h2 className={`text-lg font-semibold ${headerCls}`}>ServiceNow SLAs</h2>
                <span className={`text-xs px-2 py-1 rounded ${pillCls}`}>
                    {slas.length} {slas.length === 1 ? 'record' : 'records'}
                </span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className={`text-left text-xs font-semibold uppercase tracking-wider ${tableHeadCls}`}>
                            <th className="pb-3 pr-4">SLA Name</th>
                            <th className="pb-3 pr-4">Stage</th>
                            <th className="pb-3 pr-4">%</th>
                            <th className="pb-3 pr-4">Business %</th>
                            <th className="pb-3 pr-4">Schedule</th>
                            <th className="pb-3 pr-4">Start</th>
                            <th className="pb-3 pr-4">End</th>
                            <th className="pb-3 pr-4">Breach</th>
                            <th className="pb-3 pr-4">Biz Duration</th>
                            <th className="pb-3 pr-4">Time Left</th>
                        </tr>
                    </thead>
                    <tbody>
                        {slas.map((sla) => {
                            const { label, cls: pill, Icon } = stagePill(
                                sla.stage,
                                sla.has_breached,
                                sla.made_sla,
                            );
                            return (
                                <tr key={sla.oid} className={`border-t ${rowBorderCls}`}>
                                    <td className="py-3 pr-4 align-top">
                                        <div className={`${headerCls} font-medium`}>
                                            {sla.sla_name ?? '—'}
                                        </div>
                                        <div className={`text-xs font-mono ${mutedCls}`}>
                                            {sla.sn_sys_id}
                                        </div>
                                    </td>
                                    <td className="py-3 pr-4 align-top">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${pill}`}>
                                            <Icon className="w-3 h-3" />
                                            {label}
                                        </span>
                                    </td>
                                    <td className="py-3 pr-4 align-top">{formatPct(sla.percentage)}</td>
                                    <td className="py-3 pr-4 align-top">{formatPct(sla.business_percentage)}</td>
                                    <td className="py-3 pr-4 align-top">
                                        <div>{sla.schedule ?? '—'}</div>
                                        <div className={`text-xs ${mutedCls}`}>{sla.schedule_timezone ?? ''}</div>
                                    </td>
                                    <td className="py-3 pr-4 align-top">
                                        {formatDateTime(sla.start_time, timezone)}
                                    </td>
                                    <td className="py-3 pr-4 align-top">
                                        {sla.end_time ? formatDateTime(sla.end_time, timezone) : '—'}
                                    </td>
                                    <td className="py-3 pr-4 align-top">
                                        {formatDateTime(sla.breach_time, timezone)}
                                    </td>
                                    <td className="py-3 pr-4 align-top">
                                        {formatDuration(sla.business_duration_sec)}
                                    </td>
                                    <td className="py-3 pr-4 align-top">
                                        {formatDuration(sla.business_time_left_sec)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
