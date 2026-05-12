'use client';

/**
 * GroupBarCard — titled card with a horizontal recharts bar chart,
 * sorted descending, top-N defaulted to 10.
 *
 * Accepts the `{ key, count }` shape produced by `groupBy()` in
 * `lib/ops_dashboard/aggregate`.
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { useTheme } from '@/lib/contexts/theme-context';
import type { GroupCount } from '@/lib/ops_dashboard/aggregate';
import { TitleWithInfo } from './TitleWithInfo';

export interface GroupBarCardProps {
    title: string;
    subtitle?: string;
    /** Optional definition / formula shown on hover as a tooltip next to the title. */
    info?: string;
    data: GroupCount[];
    /** Limit to the top N by count. Defaults to 10. */
    topN?: number;
    height?: number;
    /** Bar colour — single colour or an array indexed by rank. */
    color?: string | string[];
    onBarClick?: (row: GroupCount) => void;
    emptyText?: string;
    actionSlot?: React.ReactNode;
    /** Optional label prefix for the x-axis (e.g. "Tickets"). */
    xAxisLabel?: string;
}

export function GroupBarCard({
    title,
    subtitle,
    info,
    data,
    topN = 10,
    height,
    color = '#3b82f6',
    onBarClick,
    emptyText = 'No data',
    actionSlot,
    xAxisLabel,
}: GroupBarCardProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const cardBase = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';
    const titleCls = isLight ? 'text-slate-800' : 'text-white';
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const emptyCls = isLight ? 'text-slate-400' : 'text-gray-500';

    const axisStroke = isLight ? '#94a3b8' : '#64748b';
    const gridStroke = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)';

    const trimmed = data.slice(0, topN);
    // Give the chart a sane height based on row count — 28px/row + padding.
    const chartHeight = height ?? Math.max(120, trimmed.length * 28 + 40);

    function getBarColor(index: number): string {
        if (Array.isArray(color)) return color[index % color.length];
        return color;
    }

    return (
        <div className={`rounded-xl border p-4 ${cardBase}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <TitleWithInfo title={title} subtitle={subtitle} info={info} />
                {actionSlot}
            </div>

            {trimmed.length === 0 ? (
                <div className={`text-center text-xs py-8 ${emptyCls}`}>{emptyText}</div>
            ) : (
                <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart
                        data={trimmed}
                        layout="vertical"
                        margin={{ top: 4, right: 20, bottom: 4, left: 8 }}
                    >
                        <CartesianGrid stroke={gridStroke} horizontal={false} />
                        <XAxis
                            type="number"
                            stroke={axisStroke}
                            tick={{ fontSize: 11 }}
                            allowDecimals={false}
                            label={
                                xAxisLabel
                                    ? { value: xAxisLabel, position: 'insideBottom', fontSize: 11, fill: axisStroke }
                                    : undefined
                            }
                        />
                        <YAxis
                            type="category"
                            dataKey="key"
                            stroke={axisStroke}
                            tick={{ fontSize: 11 }}
                            width={110}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isLight ? '#fff' : '#1e293b',
                                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: isLight ? '#1e293b' : '#f1f5f9',
                                fontSize: '12px',
                            }}
                            // Recharts ignores ``contentStyle.color`` for the
                            // per-item line and the category label — those
                            // are rendered with their own styles and default
                            // to black, which is invisible on the dark
                            // dashboard. Force them to follow the theme.
                            itemStyle={{ color: isLight ? '#1e293b' : '#f1f5f9' }}
                            labelStyle={{ color: isLight ? '#1e293b' : '#f1f5f9' }}
                            cursor={{ fill: isLight ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.12)' }}
                            formatter={(value) => [Number(value ?? 0).toLocaleString(), '']}
                        />
                        <Bar
                            dataKey="count"
                            radius={[0, 4, 4, 0]}
                            cursor={onBarClick ? 'pointer' : undefined}
                            onClick={
                                onBarClick
                                    ? (payload: { payload?: GroupCount } | GroupCount) => {
                                        const row = 'payload' in payload && payload.payload ? payload.payload : (payload as GroupCount);
                                        onBarClick(row);
                                    }
                                    : undefined
                            }
                        >
                            {trimmed.map((_, i) => (
                                <Cell key={i} fill={getBarColor(i)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
