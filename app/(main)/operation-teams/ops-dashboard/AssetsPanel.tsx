'use client';

/**
 * AssetsPanel — lower section of the Active Monitoring Hub.
 *
 * Renders the 7 asset KPI tiles, three donuts (in-stock location,
 * procured-by, support-group), and the support-group × device-type
 * stacked bar. Filter state lives on the parent.
 */

import { DollarSign, HardDrive, HelpCircle, PackageCheck, Truck, Wrench } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import type { AssetKpis } from '@/lib/ops_dashboard/aggregate';

const ASSET_PALETTE = ['#118DFF', '#0B72D7', '#098BF5', '#54B5FB', '#71C0A7', '#57B956', '#478F48', '#326633'];
const MAC_COLOR = '#6366f1';
const WIN_COLOR = '#3b82f6';
const OTHER_COLOR = '#0ea5e9';

export interface SupportGroupMatrixRow {
    name: string;
    displayName: string;
    Mac: number;
    Windows: number;
    Other: number;
    total: number;
}

export interface AssetsPanelProps {
    kpis: AssetKpis;
    inStockLocationSlices: Array<{ name: string; value: number }>;
    procuredBySlices: Array<{ name: string; value: number }>;
    supportGroupSlices: Array<{ name: string; value: number }>;
    supportGroupMatrix: SupportGroupMatrixRow[];
    loading: boolean;
    filteredCount: number;
    totalCount: number;
    onProcuredSliceClick: (slice: { name: string }) => void;
    onSupportGroupSliceClick: (slice: { name: string }) => void;
    /** Optional click + legend wiring for the In-Stock Location donut. */
    onLocationSliceClick?: (slice: { name: string }) => void;
    selectedLocations?: string[];
    onLocationLegendToggle?: (name: string) => void;
    selectedProcured?: string[];
    onProcuredLegendToggle?: (name: string) => void;
    selectedSupportGroups?: string[];
    onSupportGroupLegendToggle?: (name: string) => void;
}

export function AssetsPanel({
    kpis,
    inStockLocationSlices,
    procuredBySlices,
    supportGroupSlices,
    supportGroupMatrix,
    loading,
    filteredCount,
    totalCount,
    onProcuredSliceClick,
    onSupportGroupSliceClick,
    onLocationSliceClick,
    selectedLocations,
    onLocationLegendToggle,
    selectedProcured,
    onProcuredLegendToggle,
    selectedSupportGroups,
    onSupportGroupLegendToggle,
}: AssetsPanelProps) {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';
    const cardBg = isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10';
    const sectionBg = isLight ? 'bg-slate-100/60 border-slate-200' : 'bg-white/[0.03] border-white/10';
    const axisStroke = isLight ? '#94a3b8' : '#64748b';
    const emptyText = loading ? t('empty.loading') : t('empty.noData');

    return (
        <div className={`rounded-xl border p-3 ${sectionBg}`}>
            <div className="flex items-center justify-between mb-2">
                <p className={`text-xs font-semibold uppercase tracking-wider ${textMuted}`}>
                    {t('pages.hubAssetsSection')}
                </p>
                <span className="text-xs text-blue-400">
                    {t('pages.hubFilteredAssets', {
                        filtered: filteredCount.toLocaleString(),
                        total: totalCount.toLocaleString(),
                    })}
                </span>
            </div>

            {/* KPI row — each tile drills into its dedicated dashboard
                via the right-side arrow:
                  Total Assets / Zero Residual → Asset Hub
                  In Stock Rate / In Stock     → In-Stock Assets
                  Pending Return / Repair / Unconfirmed → Pending Assets */}
            <div className="grid grid-cols-7 gap-2 mb-3">
                <KpiCard
                    label={t('kpis.totalAssets')}
                    value={kpis.total}
                    icon={HardDrive}
                    linkHref="/operation-teams/ops-dashboard/assets"
                    linkLabel="Open Asset Hub"
                />
                <KpiCard
                    label={t('kpis.inStockRate')}
                    value={kpis.total > 0 ? `${kpis.inStockRatePct}%` : '—'}
                    linkHref="/operation-teams/ops-dashboard/in-stock-assets"
                    linkLabel="Open In-Stock Assets dashboard"
                />
                <KpiCard
                    label={t('kpis.inStock')}
                    value={kpis.inStock}
                    icon={PackageCheck}
                    linkHref="/operation-teams/ops-dashboard/in-stock-assets"
                    linkLabel="Open In-Stock Assets dashboard"
                />
                <KpiCard
                    label={t('kpis.pendingReturn')}
                    value={kpis.pendingReturn}
                    icon={Truck}
                    linkHref="/operation-teams/ops-dashboard/pending-assets"
                    linkLabel="Open Pending Assets dashboard"
                />
                <KpiCard
                    label={t('kpis.pendingRepair')}
                    value={kpis.pendingRepair}
                    icon={Wrench}
                    linkHref="/operation-teams/ops-dashboard/pending-assets"
                    linkLabel="Open Pending Assets dashboard"
                />
                <KpiCard
                    label={t('kpis.unconfirmed')}
                    value={kpis.unconfirmed}
                    icon={HelpCircle}
                    linkHref="/operation-teams/ops-dashboard/pending-assets"
                    linkLabel="Open Pending Assets dashboard"
                />
                <KpiCard
                    label={t('kpis.zeroResidual')}
                    value={kpis.zeroResidual}
                    icon={DollarSign}
                    linkHref="/operation-teams/ops-dashboard/assets"
                    linkLabel="Open Asset Hub"
                />
            </div>

            {/* Charts row 1 — three donuts */}
            <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <DonutCard
                    title={t('charts.inStockLocation')}
                    data={inStockLocationSlices}
                    palette={ASSET_PALETTE}
                    height={180}
                    onSliceClick={onLocationSliceClick}
                    selectedSlices={selectedLocations}
                    onLegendToggle={onLocationLegendToggle}
                    emptyText={emptyText}
                />
                <DonutCard
                    title={t('charts.procuredBy')}
                    subtitle={t('charts.procuredBySubtitle')}
                    data={procuredBySlices}
                    palette={ASSET_PALETTE}
                    height={180}
                    onSliceClick={onProcuredSliceClick}
                    selectedSlices={selectedProcured}
                    onLegendToggle={onProcuredLegendToggle}
                    emptyText={emptyText}
                />
                <DonutCard
                    title={t('charts.supportGroup')}
                    subtitle={t('charts.supportGroupSubtitle')}
                    data={supportGroupSlices}
                    palette={ASSET_PALETTE}
                    height={180}
                    onSliceClick={onSupportGroupSliceClick}
                    selectedSlices={selectedSupportGroups}
                    onLegendToggle={onSupportGroupLegendToggle}
                    emptyText={emptyText}
                />
            </div>

            {/* Charts row 2 — stacked bar */}
            <div className={`rounded-xl border p-4 ${cardBg}`}>
                <div className="flex items-center justify-between mb-2">
                    <h3 className={`text-sm font-medium ${textMain}`}>{t('charts.supportGroupDevice')}</h3>
                    <div className={`flex gap-4 text-xs ${textMuted}`}>
                        {[
                            { color: MAC_COLOR, label: t('charts.legendMac') },
                            { color: WIN_COLOR, label: t('charts.legendWindows') },
                            { color: OTHER_COLOR, label: t('charts.legendOther') },
                        ].map(({ color, label }) => (
                            <span key={label} className="flex items-center gap-1">
                                <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />
                                {label}
                            </span>
                        ))}
                    </div>
                </div>
                {supportGroupMatrix.length === 0 ? (
                    <div className={`text-center text-xs py-8 ${textMuted}`}>{emptyText}</div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={supportGroupMatrix} margin={{ top: 8, right: 10, left: -10, bottom: 28 }}>
                            <XAxis
                                dataKey="displayName"
                                tick={{ fontSize: 10, fill: axisStroke }}
                                axisLine={false}
                                tickLine={false}
                                angle={-30}
                                textAnchor="end"
                                interval={0}
                            />
                            <YAxis tick={{ fontSize: 10, fill: axisStroke }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: isLight ? '#fff' : '#1e293b',
                                    border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                }}
                            />
                            <Bar dataKey="Mac" stackId="a" fill={MAC_COLOR} />
                            <Bar dataKey="Windows" stackId="a" fill={WIN_COLOR} />
                            <Bar dataKey="Other" stackId="a" fill={OTHER_COLOR} radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
