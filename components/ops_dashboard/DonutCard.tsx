'use client';

/**
 * DonutCard — titled card with a recharts donut + legend.
 *
 * Accepts a colour palette prop so each page can pick its own; defaults
 * match the SurveyAnalytics status-donut palette. An optional
 * `onSliceClick` callback enables cross-filtering from the drill-in
 * donuts on pages like Pending Assets.
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useTheme } from '@/lib/contexts/theme-context';

export interface DonutSlice {
    name: string;
    value: number;
    color?: string;
}

export interface DonutCardProps {
    title: string;
    subtitle?: string;
    data: DonutSlice[];
    /** Fallback palette for slices that don't carry their own colour. */
    palette?: string[];
    height?: number;
    onSliceClick?: (slice: DonutSlice) => void;
    /** Render a custom right-side action in the card header. */
    actionSlot?: React.ReactNode;
    emptyText?: string;
}

const DEFAULT_PALETTE = [
    '#3b82f6',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#94a3b8',
];

export function DonutCard({
    title,
    subtitle,
    data,
    palette = DEFAULT_PALETTE,
    height = 520,
    onSliceClick,
    actionSlot,
    emptyText = 'No data',
}: DonutCardProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const cardBase = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';
    const titleCls = isLight ? 'text-slate-800' : 'text-white';
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const emptyCls = isLight ? 'text-slate-400' : 'text-gray-500';

    const coloured = data.map((slice, i) => ({
        ...slice,
        color: slice.color ?? palette[i % palette.length],
    }));
    const nonZero = coloured.filter((s) => s.value > 0);

    return (
        <div className={`rounded-xl border p-4 ${cardBase}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h3 className={`text-sm font-medium ${titleCls}`}>{title}</h3>
                    {subtitle && <p className={`text-xs mt-0.5 ${subtitleCls}`}>{subtitle}</p>}
                </div>
                {actionSlot}
            </div>

            {nonZero.length === 0 ? (
                <div className={`text-center text-xs py-8 ${emptyCls}`}>{emptyText}</div>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <PieChart>
                        <Pie
                            data={nonZero}
                            cx="50%"
                            cy="42%"
                            innerRadius="62%"
                            outerRadius="98%"
                            paddingAngle={2}
                            dataKey="value"
                            cursor={onSliceClick ? 'pointer' : undefined}
                            onClick={onSliceClick ? (_, idx: number) => onSliceClick(nonZero[idx]) : undefined}
                        >
                            {nonZero.map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isLight ? '#fff' : '#1e293b',
                                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: isLight ? '#1e293b' : '#f1f5f9',
                            }}
                            formatter={(value) => [Number(value ?? 0).toLocaleString(), '']}
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={72}
                            wrapperStyle={{
                                paddingTop: '4px',
                                maxHeight: '80px',
                                overflowY: 'auto',
                                lineHeight: '18px',
                            }}
                            formatter={(v: string) => (
                                <span style={{ color: isLight ? '#475569' : '#94a3b8', fontSize: '12px' }}>
                                    {v}
                                </span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
