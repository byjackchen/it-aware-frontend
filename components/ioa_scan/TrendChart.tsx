/**
 * 3-day trend chart — 4 overlaid lines (connections, failure %, blocked %,
 * avg latency ms) with **three Y axes** so each metric sits on a scale
 * where its shape is readable:
 *   - left          = % (0-100)        → failure_rate, blocked_rate
 *   - right (inner) = connections      → connections per hour
 *   - right (outer) = ms                → avg_latency_ms
 *
 * Sharing one right axis squashed latency (~30 ms) flat against an axis
 * that has to accommodate connections (~10K). Three axes let each line
 * use its full vertical range.
 *
 * Tooltip styling is theme-aware (the default Recharts tooltip is white
 * with low-contrast text — invisible against the dark UI).
 */
'use client';

import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useTheme } from '@/lib/contexts/theme-context';
import type { IoaScanRead, TrendBucket } from '@/lib/types/networks/ioa_scans';

const COLORS = {
    connections: '#3b82f6',  // blue-500
    failure: '#ef4444',      // red-500
    blocked: '#f59e0b',      // amber-500
    latency: '#10b981',      // emerald-500
};

type ChartRow = {
    ts: string;
    label: string;
    connections: number;
    failure_rate_pct: number | null;
    blocked_rate_pct: number | null;
    avg_latency_ms: number | null;
};

function bucketToRow(b: TrendBucket): ChartRow {
    const fr = b.connections > 0 ? (b.failures / b.connections) * 100 : null;
    const br = b.connections > 0 ? (b.blocked / b.connections) * 100 : null;
    return {
        ts: b.ts,
        label: new Date(b.ts).toLocaleString(undefined, {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
        }),
        connections: b.connections,
        failure_rate_pct: fr,
        blocked_rate_pct: br,
        avg_latency_ms: b.avg_latency_ms,
    };
}

export function TrendChart({ scan }: { scan: IoaScanRead }) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const rows: ChartRow[] = (scan.trend_hourly_buckets ?? []).map(bucketToRow);

    const tooltipContentStyle: React.CSSProperties = {
        background: isLight ? '#ffffff' : '#0f172a',           // slate-900
        border: `1px solid ${isLight ? '#e2e8f0' : '#334155'}`, // slate-700
        borderRadius: 6,
        color: isLight ? '#0f172a' : '#e2e8f0',                 // slate-200
        fontSize: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    };
    const tooltipItemStyle: React.CSSProperties = {
        color: isLight ? '#0f172a' : '#e2e8f0',
    };
    const tooltipLabelStyle: React.CSSProperties = {
        color: isLight ? '#475569' : '#cbd5e1',
        marginBottom: 4,
        fontWeight: 600,
    };

    const axisStroke = isLight ? '#94a3b8' : '#64748b';        // slate-400 / slate-500

    return (
        <section>
            <h2 className="text-lg font-semibold mb-2">
                Network Trend · Last {scan.trend_window_hours} Hours
            </h2>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: axisStroke }}
                            interval="preserveStartEnd"
                            minTickGap={32}
                            stroke={axisStroke}
                        />
                        <YAxis
                            yAxisId="pct"
                            orientation="left"
                            domain={[0, 100]}
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 10, fill: axisStroke }}
                            width={42}
                            stroke={axisStroke}
                        />
                        <YAxis
                            yAxisId="conn"
                            orientation="right"
                            tick={{ fontSize: 10, fill: COLORS.connections }}
                            tickFormatter={(v) =>
                                v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
                            }
                            width={44}
                            stroke={COLORS.connections}
                        />
                        <YAxis
                            yAxisId="lat"
                            orientation="right"
                            tick={{ fontSize: 10, fill: COLORS.latency }}
                            tickFormatter={(v) => `${v}ms`}
                            width={48}
                            stroke={COLORS.latency}
                        />
                        <Tooltip
                            contentStyle={tooltipContentStyle}
                            itemStyle={tooltipItemStyle}
                            labelStyle={tooltipLabelStyle}
                            cursor={{ stroke: axisStroke, strokeDasharray: '3 3' }}
                            formatter={(value, name) => {
                                if (value === null || value === undefined) return ['—', name];
                                if (name === 'Failure rate' || name === 'Blocked rate') {
                                    return [`${(value as number).toFixed(2)}%`, name];
                                }
                                if (name === 'Avg latency') {
                                    return [`${(value as number).toFixed(0)} ms`, name];
                                }
                                return [(value as number).toLocaleString(), name];
                            }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line
                            yAxisId="conn"
                            type="monotone"
                            dataKey="connections"
                            name="Connections"
                            stroke={COLORS.connections}
                            dot={false}
                            strokeWidth={1.5}
                        />
                        <Line
                            yAxisId="pct"
                            type="monotone"
                            dataKey="failure_rate_pct"
                            name="Failure rate"
                            stroke={COLORS.failure}
                            dot={false}
                            strokeWidth={1.5}
                            connectNulls={false}
                        />
                        <Line
                            yAxisId="pct"
                            type="monotone"
                            dataKey="blocked_rate_pct"
                            name="Blocked rate"
                            stroke={COLORS.blocked}
                            dot={false}
                            strokeWidth={1.5}
                            connectNulls={false}
                        />
                        <Line
                            yAxisId="lat"
                            type="monotone"
                            dataKey="avg_latency_ms"
                            name="Avg latency"
                            stroke={COLORS.latency}
                            dot={false}
                            strokeWidth={1.5}
                            connectNulls={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                peak: {scan.trend_peak_hour_count ?? '—'} connections · offline minutes:{' '}
                {scan.trend_offline_minutes ?? '—'}
            </div>
        </section>
    );
}
