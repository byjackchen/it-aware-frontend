'use client';

/**
 * DonutCard — titled card with a recharts donut + legend.
 *
 * Accepts a colour palette prop so each page can pick its own; defaults
 * match the SurveyAnalytics status-donut palette. An optional
 * `onSliceClick` callback enables cross-filtering from the drill-in
 * donuts on pages like Pending Assets.
 *
 * The recharts hover tooltip is intentionally omitted — when in
 * interactive mode {@link DonutLegend} already shows each slice's
 * name, count, and percentage, so the chart stays uncluttered.
 *
 * **Interactive-legend mode** (opt-in): pass `selectedSlices` +
 * `onLegendToggle` to swap the recharts built-in legend for the
 * external {@link DonutLegend}. When in interactive mode:
 *   - Selected slices keep full opacity and gain a white stroke.
 *   - Unselected slices dim to opacity 0.25.
 *   - When nothing is selected, all slices render at full opacity (no
 *     filter active).
 *
 * Existing callers that don't pass these new props are unaffected.
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useTheme } from '@/lib/contexts/theme-context';
import { DonutLegend } from './DonutLegend';
import { TitleWithInfo } from './TitleWithInfo';

export interface DonutSlice {
    name: string;
    value: number;
    color?: string;
}

export interface DonutCardProps {
    title: string;
    subtitle?: string;
    /** If provided, a ? icon next to the subtitle reveals this on hover. */
    subtitleTooltip?: string;
    /** Optional definition / formula shown on hover as a tooltip next to the title. */
    info?: string;
    data: DonutSlice[];
    /** Fallback palette for slices that don't carry their own colour. */
    palette?: string[];
    height?: number;
    onSliceClick?: (slice: DonutSlice) => void;
    /** Render a custom right-side action in the card header. */
    actionSlot?: React.ReactNode;
    emptyText?: string;
    /**
     * Interactive-legend mode (opt-in). When set together with
     * `onLegendToggle`, the recharts internal Legend is replaced by
     * {@link DonutLegend} and the donut visually reflects the
     * selection (white stroke on selected, 0.25 opacity on others).
     * Empty array = "no filter" — all slices full opacity.
     */
    selectedSlices?: string[];
    /** Called when the user clicks a legend item; pairs with `selectedSlices`. */
    onLegendToggle?: (name: string) => void;
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
    subtitleTooltip,
    info,
    data,
    palette = DEFAULT_PALETTE,
    height = 500,
    onSliceClick,
    actionSlot,
    emptyText = 'No data',
    selectedSlices,
    onLegendToggle,
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

    // Interactive legend is enabled iff both props are supplied. Existing
    // callers that omit them fall through to the recharts built-in legend
    // — preserves backward compatibility.
    const interactive = selectedSlices !== undefined && onLegendToggle !== undefined;
    const noneSelected = !interactive || (selectedSlices?.length ?? 0) === 0;
    const total = nonZero.reduce((s, x) => s + x.value, 0);

    // Reserve a fixed slot under the chart for the external legend so
    // the overall card height stays close to its non-interactive size.
    const externalLegendHeight = 64;
    const chartHeight = interactive ? Math.max(height - externalLegendHeight, 120) : height;

    return (
        <div className={`rounded-xl border p-4 w-full h-full ${cardBase}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <TitleWithInfo title={title} subtitle={subtitle} subtitleTooltip={subtitleTooltip} info={info} />
                {actionSlot}
            </div>

            {nonZero.length === 0 ? (
                <div className={`text-center text-xs py-8 ${emptyCls}`}>{emptyText}</div>
            ) : (
                <>
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <PieChart>
                            <Pie
                                data={nonZero}
                                cx="50%"
                                cy="48%"
                                innerRadius="60%"
                                outerRadius="92%"
                                paddingAngle={2}
                                dataKey="value"
                                cursor={onSliceClick ? 'pointer' : undefined}
                                onClick={onSliceClick ? (_, idx: number) => onSliceClick(nonZero[idx]) : undefined}
                            >
                                {nonZero.map((entry, index) => {
                                    // In interactive mode with a non-empty selection,
                                    // dim non-selected slices and outline selected ones.
                                    const selectedHere =
                                        interactive && !noneSelected && selectedSlices!.includes(entry.name);
                                    const dimmed = interactive && !noneSelected && !selectedHere;
                                    return (
                                        <Cell
                                            key={index}
                                            fill={entry.color}
                                            fillOpacity={dimmed ? 0.25 : 1}
                                            stroke={selectedHere ? '#ffffff' : undefined}
                                            strokeWidth={selectedHere ? 2 : 0}
                                        />
                                    );
                                })}
                            </Pie>
                            {/* Themed tooltip — shows slice name + count
                                + share-of-total. recharts' default is a
                                white panel with black text, which is
                                illegible on the dark dashboard theme,
                                AND it doesn't surface the slice name on
                                Pie charts unless we render a custom
                                content. */}
                            <Tooltip
                                cursor={false}
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const entry = payload[0];
                                    const name = (entry.payload as { name?: string }).name ?? '';
                                    const value = Number(entry.value ?? 0);
                                    const pct = total > 0 ? (value / total) * 100 : 0;
                                    const swatch = (entry.payload as { color?: string }).color;
                                    return (
                                        <div
                                            style={{
                                                backgroundColor: isLight ? '#fff' : '#1e293b',
                                                border: isLight
                                                    ? '1px solid #e2e8f0'
                                                    : '1px solid rgba(255,255,255,0.12)',
                                                borderRadius: 8,
                                                color: isLight ? '#1e293b' : '#f1f5f9',
                                                fontSize: 12,
                                                padding: '8px 10px',
                                                lineHeight: 1.4,
                                                boxShadow: isLight
                                                    ? '0 4px 12px rgba(15,23,42,0.08)'
                                                    : '0 4px 12px rgba(0,0,0,0.4)',
                                                minWidth: 140,
                                            }}
                                        >
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    fontWeight: 600,
                                                    marginBottom: 2,
                                                }}
                                            >
                                                {swatch && (
                                                    <span
                                                        style={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: 2,
                                                            background: swatch,
                                                            display: 'inline-block',
                                                        }}
                                                    />
                                                )}
                                                <span>{name}</span>
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    gap: 12,
                                                    color: isLight ? '#475569' : '#94a3b8',
                                                }}
                                            >
                                                <span>Count</span>
                                                <span
                                                    style={{
                                                        color: isLight ? '#1e293b' : '#f1f5f9',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {value.toLocaleString()}
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    gap: 12,
                                                    color: isLight ? '#475569' : '#94a3b8',
                                                }}
                                            >
                                                <span>Share</span>
                                                <span
                                                    style={{
                                                        color: isLight ? '#1e293b' : '#f1f5f9',
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
                                                >
                                                    {pct.toFixed(1)}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                            {!interactive && (
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
                            )}
                        </PieChart>
                    </ResponsiveContainer>
                    {interactive && (
                        <DonutLegend
                            items={nonZero.map((s) => ({ name: s.name, value: s.value, color: s.color! }))}
                            selected={selectedSlices!}
                            onToggle={onLegendToggle!}
                            total={total}
                        />
                    )}
                </>
            )}
        </div>
    );
}
