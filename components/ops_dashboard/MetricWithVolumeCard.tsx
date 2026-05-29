'use client'

/**
 * MetricWithVolumeCard — dual-axis ComposedChart for the Latency Breakdown
 * dashboard. Each card shows one latency phase:
 *   - LEFT y-axis (seconds): avg / p50 / p95 lines
 *   - RIGHT y-axis (count):  that phase's hourly sample volume as faint bars,
 *     so the volume shares the exact same 口径 (filter domain) as the metric.
 *
 * Generic enough to reuse, but tailored to seconds-lines + count-bars rather
 * than StackedBarPercentLineCard's stacked-bars + percentage-lines shape.
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
    Brush,
} from 'recharts'
import { useTheme } from '@/lib/contexts/theme-context'
import { TitleWithInfo } from './TitleWithInfo'

export interface LineSeriesDef {
    key: string
    label: string
    color: string
}

export interface MetricWithVolumeRow {
    bucket: string
    [key: string]: string | number | null | undefined
}

export interface MetricWithVolumeCardProps {
    title: string
    info?: string
    data: MetricWithVolumeRow[]
    /** avg / p50 / p95 line series (left axis, seconds). */
    lineSeries: LineSeriesDef[]
    /** Data key for the volume bar series (right axis, count). */
    volumeKey: string
    volumeLabel: string
    volumeColor?: string
    height?: number
    emptyText?: string
    formatXTick: (bucket: string) => string
    zoomable?: boolean
}

export function MetricWithVolumeCard({
    title,
    info,
    data,
    lineSeries,
    volumeKey,
    volumeLabel,
    volumeColor = '#c4b5fd',
    height = 240,
    emptyText = 'No data',
    formatXTick,
    zoomable = false,
}: MetricWithVolumeCardProps) {
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const cardBase = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'
    const axisStroke = isLight ? '#94a3b8' : '#64748b'
    const gridStroke = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.08)'
    const tooltipBg = isLight ? '#fff' : '#1e293b'
    const tooltipBorder = isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'
    const tooltipText = isLight ? '#1e293b' : '#f1f5f9'

    return (
        <div className={`rounded-xl border p-4 w-full ${cardBase}`}>
            <div className="mb-3">
                <TitleWithInfo title={title} info={info} />
            </div>
            {data.length === 0 ? (
                <div className={`text-center text-xs py-8 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                    {emptyText}
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={height}>
                    <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
                        <CartesianGrid stroke={gridStroke} vertical={false} />
                        <XAxis
                            dataKey="bucket"
                            tickFormatter={formatXTick}
                            stroke={axisStroke}
                            tick={{ fontSize: 11 }}
                        />
                        {/* left: seconds */}
                        <YAxis
                            yAxisId="sec"
                            stroke={axisStroke}
                            tick={{ fontSize: 11 }}
                            width={44}
                        />
                        {/* right: count (volume) */}
                        <YAxis
                            yAxisId="vol"
                            orientation="right"
                            stroke={axisStroke}
                            tick={{ fontSize: 11 }}
                            allowDecimals={false}
                            width={40}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: tooltipBg,
                                border: `1px solid ${tooltipBorder}`,
                                borderRadius: '8px',
                                color: tooltipText,
                                fontSize: '12px',
                            }}
                            itemStyle={{ color: tooltipText }}
                            labelStyle={{ color: tooltipText }}
                            labelFormatter={(label) => formatXTick(String(label))}
                        />
                        <Legend
                            verticalAlign="top"
                            align="right"
                            height={24}
                            wrapperStyle={{ fontSize: '11px', color: axisStroke }}
                        />
                        {/* Volume bars first so the lines render on top. */}
                        <Bar
                            yAxisId="vol"
                            dataKey={volumeKey}
                            name={volumeLabel}
                            fill={volumeColor}
                            fillOpacity={isLight ? 0.45 : 0.35}
                            barSize={10}
                        />
                        {lineSeries.map((s) => (
                            <Line
                                key={s.key}
                                yAxisId="sec"
                                type="monotone"
                                dataKey={s.key}
                                name={s.label}
                                stroke={s.color}
                                strokeWidth={2}
                                dot={{ r: 2, fill: s.color }}
                                activeDot={{ r: 4 }}
                                connectNulls={false}
                            />
                        ))}
                        {zoomable && data.length > 4 && (
                            <Brush
                                dataKey="bucket"
                                height={18}
                                stroke={axisStroke}
                                fill={isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)'}
                                travellerWidth={8}
                                tickFormatter={formatXTick}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            )}
        </div>
    )
}
