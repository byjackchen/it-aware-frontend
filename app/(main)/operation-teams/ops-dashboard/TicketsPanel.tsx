'use client';

/**
 * TicketsPanel — upper section of the Active Monitoring Hub.
 *
 * Renders the 8 ticket KPI tiles plus the three charts (assignment-
 * group donut, 10-month trend line, region bubble map). Filter state
 * lives on the parent so the sidebar can drive it.
 */

import { Activity, AlertTriangle, AlertCircle, Boxes, Briefcase, Star, UserX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { GroupBarCard } from '@/components/ops_dashboard/GroupBarCard';
// TrendLineCard dropped along with the monthly-opened trend card.
import { RegionMap, type RegionBubble } from '@/components/ops_dashboard/RegionMap';
import type { DeltaInfo, GroupCount, TrendPoint } from '@/lib/ops_dashboard/aggregate';

const DONUT_PALETTE = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#94a3b8'];

export interface TicketKpis {
    totalActive: number;
    activeIncident: number;
    activeIncidentHigh: number;
    activeCatalog: number;
    activeAsset: number;
    vipActive: number;
    unassigned: number;
    agingIncidentGt2d: number;
    agingCatalogGt30d: number;
    agingAssetGt30d: number;
}

export interface TicketKpiDeltas {
    totalActive?: DeltaInfo | null;
    activeIncident?: DeltaInfo | null;
    activeCatalog?: DeltaInfo | null;
    activeAsset?: DeltaInfo | null;
    vipActive?: DeltaInfo | null;
}

export interface TicketsPanelProps {
    kpis: TicketKpis;
    groupDonut: Array<{ name: string; value: number }>;
    /** Top-N assignee bar chart data — ranked by active ticket count. */
    assigneeBar: GroupCount[];
    trend: TrendPoint[];
    trendMonths: number;
    regionData: RegionBubble[];
    loading: boolean;
    filteredCount: number;
    totalActiveCount: number;
    onGroupSliceClick: (slice: { name: string }) => void;
    /** Selected slice names for the assignment-group donut. */
    selectedGroups?: string[];
    /** Legend toggle handler for the assignment-group donut. */
    onGroupLegendToggle?: (name: string) => void;
    /** Optional MoM deltas — rendered as the small localized delta footer on each tile. */
    kpiDeltas?: TicketKpiDeltas;
}

export function TicketsPanel({
    kpis,
    groupDonut,
    assigneeBar,
    // `trend` / `trendMonths` are still on the props contract for
    // backwards-compat with OpsDashboardHub; the monthly-opened trend
    // card was removed from the row, so we deliberately don't read
    // these locally any more.
    trend: _trend,
    trendMonths: _trendMonths,
    regionData,
    loading,
    filteredCount,
    totalActiveCount,
    onGroupSliceClick,
    selectedGroups,
    onGroupLegendToggle,
    kpiDeltas,
}: TicketsPanelProps) {
    const t = useTranslations('OpsDashboard');
    function deltaProp(d?: DeltaInfo | null) {
        if (!d) return undefined;
        const value = d.trend === 'flat'
            ? t('kpis.momFlat')
            : t('kpis.momDelta', { arrow: d.trend === 'up' ? '▲' : '▼', pct: Math.abs(d.pct) });
        return { value, trend: d.trend };
    }
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

            {/* KPI row 1 — Total + per-type breakdown (Incidents,
                Catalog Tasks, Asset Tasks). Unassigned moved to row 2
                per user request so it sits next to the other
                "needs-attention" tiles. */}
            <div className="grid grid-cols-4 gap-2 mb-2">
                <KpiCard
                    label={t('kpis.totalActive')}
                    value={kpis.totalActive}
                    icon={Activity}
                
                        tooltip={t('kpis.totalActiveInfo')}
    />
                <KpiCard
                    label={t('kpis.activeIncident')}
                    value={kpis.activeIncident}
                    icon={AlertTriangle}
                
                        tooltip={t('kpis.activeIncidentInfo')}
    />
                <KpiCard
                    label={t('kpis.activeCatalog')}
                    value={kpis.activeCatalog}
                    icon={Briefcase}
                
                        tooltip={t('kpis.activeCatalogInfo')}
    />
                <KpiCard
                    label={t('kpis.activeAsset')}
                    value={kpis.activeAsset}
                    icon={Boxes}
                
                        tooltip={t('kpis.activeAssetInfo')}
    />
            </div>
            {/* KPI row 2 — Unassigned (lead) + High Priority + VIP +
                Aging tiles share one row. Each tile drills into its
                dedicated dashboard via the right-side arrow. */}
            <div className="grid grid-cols-6 gap-2 mb-3">
                <KpiCard
                    label={t('kpis.unassigned')}
                    value={kpis.unassigned}
                    icon={UserX}
                    tooltip={t('kpis.unassignedInfo')}
                    linkHref="/operation-teams/ops-dashboard/unassigned"
                    linkLabel={t('links.openUnassigned')}
                    valueColor={kpis.unassigned > 10 ? 'text-red-500' : kpis.unassigned > 0 ? 'text-yellow-500' : 'text-green-500'}
                />
                <KpiCard
                    label={t('kpis.highPriorityIncident')}
                    value={kpis.activeIncidentHigh}
                    icon={AlertCircle}
                    tooltip={t('kpis.highPriorityIncidentInfo')}
                    valueColor={kpis.activeIncidentHigh > 0 ? 'text-red-500' : 'text-green-500'}
                />
                <KpiCard
                    label={t('kpis.vipActive')}
                    value={kpis.vipActive}
                    icon={Star}
                    linkHref="/operation-teams/ops-dashboard/vip-tickets"
                    linkLabel={t('links.openVipTickets')}
                    tooltip={t('kpis.vipActiveInfo')}
                    valueColor={kpis.vipActive > 0 ? 'text-red-500' : 'text-green-500'}
                />
                <KpiCard
                    label={t('kpis.agingIncidentsGt2d')}
                    value={kpis.agingIncidentGt2d}
                    linkHref="/operation-teams/ops-dashboard/aging-incidents"
                    linkLabel={t('links.openAgingIncidents')}
                    tooltip={t('kpis.agingIncidentsGt2dInfo')}
                    valueColor={kpis.agingIncidentGt2d > 0 ? 'text-yellow-500' : 'text-green-500'}
                />
                <KpiCard
                    label={t('kpis.agingCatalogGt30d')}
                    value={kpis.agingCatalogGt30d}
                    linkHref="/operation-teams/ops-dashboard/aging-sc-tasks"
                    linkLabel={t('links.openAgingCatalogTasks')}
                    tooltip={t('kpis.agingCatalogGt30dInfo')}
                    valueColor={kpis.agingCatalogGt30d > 0 ? 'text-yellow-500' : 'text-green-500'}
                />
                <KpiCard
                    label={t('kpis.agingAsset30d')}
                    value={kpis.agingAssetGt30d}
                    linkHref="/operation-teams/ops-dashboard/aging-asset-tasks"
                    linkLabel={t('links.openAgingAssetTasks')}
                    tooltip={t('kpis.agingAsset30dInfo')}
                    valueColor={kpis.agingAssetGt30d > 0 ? 'text-yellow-500' : 'text-green-500'}
                />
            </div>

            {/* Charts row — two cards share the row 50/50 after the
                monthly-opened trend line was removed per user request. */}
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <DonutCard
                    title={t('charts.byAssignmentGroupTop8')}
                    subtitle={t('charts.byAssignmentGroupTop8Subtitle')}
                    info={t('charts.byAssignmentGroupTop8Info')}
                    data={groupDonut}
                    palette={DONUT_PALETTE}
                    height={200}
                    onSliceClick={onGroupSliceClick}
                    selectedSlices={selectedGroups}
                    onLegendToggle={onGroupLegendToggle}
                    emptyText={emptyText}
                />
                <RegionMap
                    title={t('charts.worldMap')}
                    subtitle={t('charts.worldMapSubtitle')}
                    info={t('charts.worldMapInfo')}
                    data={regionData}
                    height={200}
                />
            </div>
            {/* By Assignee — horizontal bar. Bar chart over donut because
                assignee names are long (username / full-name) and the
                count of assignees can easily exceed 8, which renders
                a donut unreadable. Top 10 keeps it comparable at a
                glance. */}
            <div className="mt-3">
                <GroupBarCard
                    title={t('charts.byAssignee')}
                    subtitle={t('charts.byAssigneeSubtitle')}
                    info={t('charts.byAssigneeInfo')}
                    data={assigneeBar}
                    topN={10}
                    height={260}
                    color={DONUT_PALETTE}
                    emptyText={emptyText}
                />
            </div>
        </div>
    );
}
