'use client';

/**
 * TicketsPanel — upper section of the Active Monitoring Hub.
 *
 * Renders the 8 ticket KPI tiles plus the three charts (assignment-
 * group donut, 10-month trend line, region bubble map). Filter state
 * lives on the parent so the sidebar can drive it.
 */

import { Activity, AlertTriangle, Boxes, Briefcase, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard';
import { RegionMap, type RegionBubble } from '@/components/ops_dashboard/RegionMap';
import type { TrendPoint } from '@/lib/ops_dashboard/aggregate';

const DONUT_PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#94a3b8'];

export interface TicketKpis {
    totalActive: number;
    activeIncident: number;
    activeCatalog: number;
    activeAsset: number;
    vipActive: number;
    agingIncidentGt2d: number;
    agingCatalogGt30d: number;
    agingAssetGt30d: number;
}

export interface TicketsPanelProps {
    kpis: TicketKpis;
    groupDonut: Array<{ name: string; value: number }>;
    trend: TrendPoint[];
    regionData: RegionBubble[];
    loading: boolean;
    filteredCount: number;
    totalActiveCount: number;
    onGroupSliceClick: (slice: { name: string }) => void;
}

export function TicketsPanel({
    kpis,
    groupDonut,
    trend,
    regionData,
    loading,
    filteredCount,
    totalActiveCount,
    onGroupSliceClick,
}: TicketsPanelProps) {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';
    const sectionBg = isLight ? 'bg-slate-100/60 border-slate-200' : 'bg-white/[0.03] border-white/10';
    const emptyText = loading ? t('empty.loading') : t('empty.noData');

    return (
        <div className={`rounded-xl border p-3 mb-3 ${sectionBg}`}>
            <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                    {t('pages.hubTicketsSection')}
                </p>
                <span className="text-xs text-blue-400">
                    {t('pages.hubFilteredTickets', {
                        filtered: filteredCount.toLocaleString(),
                        total: totalActiveCount.toLocaleString(),
                    })}
                </span>
            </div>

            {/* KPI row 1 */}
            <div className="grid grid-cols-4 gap-2 mb-2">
                <KpiCard label={t('kpis.totalActive')} value={kpis.totalActive} icon={Activity} />
                <KpiCard label={t('kpis.activeIncident')} value={kpis.activeIncident} icon={AlertTriangle} />
                <KpiCard label={t('kpis.activeCatalog')} value={kpis.activeCatalog} icon={Briefcase} />
                <KpiCard label={t('kpis.activeAsset')} value={kpis.activeAsset} icon={Boxes} />
            </div>
            {/* KPI row 2 */}
            <div className="grid grid-cols-4 gap-2 mb-3">
                <KpiCard label={t('kpis.vipActive')} value={kpis.vipActive} icon={Star} />
                <KpiCard label={t('kpis.agingIncidentsGt2d')} value={kpis.agingIncidentGt2d} />
                <KpiCard label={t('kpis.agingCatalogGt30d')} value={kpis.agingCatalogGt30d} />
                <KpiCard label={t('kpis.agingAsset30d')} value={kpis.agingAssetGt30d} />
            </div>

            {/* Charts row */}
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <DonutCard
                    title={t('charts.byAssignmentGroupTop8')}
                    subtitle={t('charts.byAssignmentGroupTop8Subtitle')}
                    data={groupDonut}
                    palette={DONUT_PALETTE}
                    height={200}
                    onSliceClick={onGroupSliceClick}
                    emptyText={emptyText}
                />
                <TrendLineCard
                    title={t('charts.monthlyOpenedTrend')}
                    data={trend}
                    color="#3b82f6"
                    height={200}
                    emptyText={emptyText}
                />
                <RegionMap
                    title={t('charts.worldMap')}
                    subtitle={t('charts.worldMapSubtitle')}
                    data={regionData}
                    height={200}
                />
            </div>
        </div>
    );
}
