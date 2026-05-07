'use client';

/**
 * TrendLineCard — titled card with a recharts line chart.
 *
 * Two render modes:
 *   - **Single series (default)**: pass `data: TrendPoint[]` and the
 *     card draws one line off the `count` field. Works as before.
 *   - **Multi series**: pass `series: TrendSeries[]` plus matching
 *     `data` rows that carry each `series[i].key` as a numeric field.
 *     The card draws one `<Line>` per series and surfaces a small
 *     legend at the top of the chart so users can tell them apart.
 *     Used for cumulative opened/closed trends on the Incidents and
 *     Catalog dashboards.
 */

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Brush } from 'recharts';
import { useTheme } from '@/lib/contexts/theme-context';
export interface TrendSeries {
    /** Field name on each data point (e.g. "opened", "closed"). */
    key: string;
    /** Legend / tooltip label. */
    label: string;
    /** Stroke colour. */
    color: string;
}

/**
 * Loose row type for the chart — accepts the canonical `TrendPoint`
 * (`{bucket, count}`), the cumulative variant (`{bucket, opened,
 * closed}`), and any other `{bucket, ...numericFields}` shape an
 * extra series might need.
 */
export interface TrendChartRow {
    bucket: string;
    [key: string]: string | number;
}

export interface TrendLineCardProps {
    title: string;
    subtitle?: string;
    data: TrendChartRow[];
    height?: number;
    /** Single-series stroke colour — defaults to blue-500. Ignored when `series` is set. */
    color?: string;
    /** X-axis tick formatter — default formats the bucket ISO to "Mar". */
    formatXTick?: (bucket: string) => string;
    emptyText?: string;
    actionSlot?: React.ReactNode;
    /** Optional multi-series config; when set, replaces the single `count` line. */
    series?: TrendSeries[];
    /** Show a Brush at the bottom for click-and-drag zoom into a date range. */
    zoomable?: boolean;
}

function defaultXFormat(bucket: string): string {
    const t = Date.parse(bucket);
    if (!Number.isFinite(t)) return bucket;
    return new Date(t).toLocaleDateString(undefined, { month: 'short' });
}

export function TrendLineCard({
    title,
    subtitle,
    data,
    height = 200,
    color = '#3b82f6',
    formatXTick = defaultXFormat,
    emptyText = 'No data',
    actionSlot,
    series,
    zoomable = false,
}: TrendLineCardProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const cardBase = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';
    const titleCls = isLight ? 'text-slate-800' : 'text-white';
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const emptyCls = isLight ? 'text-slate-400' : 'text-gray-500';

    const axisStroke = isLight ? '#94a3b8' : '#64748b';
    const gridStroke = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)';

    const multi = Array.isArray(series) && series.length > 0;

    return (
        <div className={`rounded-xl border p-4 ${cardBase}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h3 className={`text-sm font-medium ${titleCls}`}>{title}</h3>
                    {subtitle && <p className={`text-xs mt-0.5 ${subtitleCls}`}>{subtitle}</p>}
                </div>
                {actionSlot}
            </div>

            {data.length === 0 ? (
                <div className={`text-center text-xs py-8 ${emptyCls}`}>{emptyText}</div>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                        <CartesianGrid stroke={gridStroke} vertical={false} />
                        <XAxis
                            dataKey="bucket"
                            tickFormatter={formatXTick}
                            stroke={axisStroke}
                            tick={{ fontSize: 11 }}
                        />
                        <YAxis
                            stroke={axisStroke}
                            tick={{ fontSize: 11 }}
                            allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isLight ? '#fff' : '#1e293b',
                                border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: isLight ? '#1e293b' : '#f1f5f9',
                                fontSize: '12px',
                            }}
                            labelFormatter={(label) => formatXTick(String(label))}
                        />
                        {multi && (
                            <Legend
                                verticalAlign="top"
                                align="right"
                                height={24}
                                iconType="line"
                                wrapperStyle={{
                                    fontSize: '11px',
                                    color: isLight ? '#475569' : '#94a3b8',
                                }}
                            />
                        )}
                        {multi ? (
                            series!.map((s) => (
                                <Line
                                    key={s.key}
                                    type="monotone"
                                    dataKey={s.key}
                                    name={s.label}
                                    stroke={s.color}
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: s.color }}
                                    activeDot={{ r: 5 }}
                                />
                            ))
                        ) : (
                            <Line
                                type="monotone"
                                dataKey="count"
                                stroke={color}
                                strokeWidth={2}
                                dot={{ r: 3, fill: color }}
                                activeDot={{ r: 5 }}
                            />
                        )}
                        {zoomable && data.length > 4 && (
                            <Brush
                                dataKey="bucket"
                                height={18}
                                stroke={color}
                                fill={isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}
                                travellerWidth={8}
                                tickFormatter={formatXTick}
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}
