'use client';

/**
 * StackedBarPercentLineCard — ComposedChart with N stacked bars + M
 * percentage lines on a secondary y-axis. Used for:
 *   - Ohla Overview: Auto Support vs Total Ask (stacked bar + auto% line)
 *   - User Ask Analysis: Behaviour & Overall Match Rate Trend
 *   - Other Case Analysis: Other# daily stacked bar (lineKeys empty)
 *
 * `data` is an array of row objects. `xKey` picks the category axis
 * (typically day/month). `stackedKeys` names the bar series (stacked in
 * array order from bottom to top). `lineKeys` names the percentage
 * series (rendered on the right y-axis, scale 0..1 → 0-100%).
 */

import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    Legend,
} from 'recharts'
import { useTheme } from '@/lib/contexts/theme-context'

export interface SeriesDef {
    key: string
    label: string
    color: string
}

export interface StackedBarPercentLineCardProps {
    title: string
    subtitle?: string
    data: Array<Record<string, string | number | null | undefined>>
    xKey: string
    stackedKeys: SeriesDef[]
    lineKeys?: SeriesDef[]
    height?: number
    emptyText?: string
    /** left-axis label, e.g. "Count of Behaviour". */
    leftAxisLabel?: string
    /** right-axis label, e.g. "FAQ Match Rate and Overall Match Rate". */
    rightAxisLabel?: string
}

function pctFmt(v: number | string) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return ''
    return `${Math.round(v * 100)}%`
}

export function StackedBarPercentLineCard({
    title,
    subtitle,
    data,
    xKey,
    stackedKeys,
    lineKeys = [],
    height = 300,
    emptyText = 'No data',
    leftAxisLabel,
    rightAxisLabel,
}: StackedBarPercentLineCardProps) {
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const cardBase = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'
    const titleCls = isLight ? 'text-slate-800' : 'text-white'
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-400'
    const axisCls = isLight ? '#475569' : '#94a3b8'
    const gridCls = isLight ? '#e2e8f0' : '#1e293b'
    const tooltipBg = isLight ? '#ffffff' : '#0f172a'
    const tooltipBorder = isLight ? '#e2e8f0' : '#334155'

    const isEmpty = data.length === 0

    return (
        <div className={`rounded-xl border p-4 ${cardBase}`}>
            <div className="mb-3">
                <h3 className={`text-sm font-medium ${titleCls}`}>{title}</h3>
                {subtitle && <p className={`text-xs mt-0.5 ${subtitleCls}`}>{subtitle}</p>}
            </div>
            {isEmpty ? (
                <div
                    className={`text-center text-xs py-10 ${
                        isLight ? 'text-slate-400' : 'text-gray-500'
                    }`}
                >
                    {emptyText}
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridCls} />
                        <XAxis
                            dataKey={xKey}
                            tick={{ fontSize: 11, fill: axisCls }}
                            interval="preserveStartEnd"
                            minTickGap={20}
                        />
                        <YAxis
                            yAxisId="left"
                            tick={{ fontSize: 11, fill: axisCls }}
                            label={
                                leftAxisLabel
                                    ? {
                                          value: leftAxisLabel,
                                          angle: -90,
                                          position: 'insideLeft',
                                          style: { fill: axisCls, fontSize: 11 },
                                      }
                                    : undefined
                            }
                        />
                        {lineKeys.length > 0 && (
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fontSize: 11, fill: axisCls }}
                                tickFormatter={pctFmt}
                                domain={[0, 1]}
                                label={
                                    rightAxisLabel
                                        ? {
                                              value: rightAxisLabel,
                                              angle: 90,
                                              position: 'insideRight',
                                              style: { fill: axisCls, fontSize: 11 },
                                          }
                                        : undefined
                                }
                            />
                        )}
                        <Tooltip
                            contentStyle={{
                                backgroundColor: tooltipBg,
                                border: `1px solid ${tooltipBorder}`,
                                fontSize: 12,
                            }}
                            formatter={(value, name, props) => {
                                const key = (props as { dataKey?: string }).dataKey
                                const isPctSeries = lineKeys.some((k) => k.key === key)
                                if (isPctSeries) return [pctFmt(value as number), name]
                                return [value, name]
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, color: axisCls }} />
                        {stackedKeys.map((s) => (
                            <Bar
                                key={s.key}
                                yAxisId="left"
                                dataKey={s.key}
                                name={s.label}
                                fill={s.color}
                                stackId="stack"
                            />
                        ))}
                        {lineKeys.map((s) => (
                            <Line
                                key={s.key}
                                yAxisId="right"
                                type="monotone"
                                dataKey={s.key}
                                name={s.label}
                                stroke={s.color}
                                strokeWidth={2}
                                dot={false}
                            />
                        ))}
                    </ComposedChart>
                </ResponsiveContainer>
            )}
        </div>
    )
}
