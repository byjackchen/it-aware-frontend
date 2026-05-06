/**
 * 3-day trend chart — 4 overlaid lines (connections/h, failure %,
 * blocked %, avg latency ms). Two Y axes:
 *   - left  = % (0-100) → failure_rate, blocked_rate
 *   - right = count/ms  → connections, avg_latency_ms
 *
 * Recharts client component.
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
import type { IoaScanRead, TrendBucket } from '@/lib/types/networks/ioa_scans';

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
    const rows: ChartRow[] = (scan.trend_hourly_buckets ?? []).map(bucketToRow);

    return (
        <section>
            <h2 className="text-lg font-semibold mb-2">
                Network Trend · Last {scan.trend_window_hours} Hours
            </h2>
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={rows} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke="rgba(148,163,184,0.15)" strokeDasharray="3 3" />
                        <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10 }}
                            interval="preserveStartEnd"
                            minTickGap={32}
                        />
                        <YAxis
                            yAxisId="pct"
                            orientation="left"
                            domain={[0, 100]}
                            tickFormatter={(v) => `${v}%`}
                            tick={{ fontSize: 10 }}
                            width={42}
                        />
                        <YAxis
                            yAxisId="abs"
                            orientation="right"
                            tick={{ fontSize: 10 }}
                            width={48}
                        />
                        <Tooltip
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
                            yAxisId="abs"
                            type="monotone"
                            dataKey="connections"
                            name="Connections"
                            stroke="#3b82f6"
                            dot={false}
                            strokeWidth={1.5}
                        />
                        <Line
                            yAxisId="pct"
                            type="monotone"
                            dataKey="failure_rate_pct"
                            name="Failure rate"
                            stroke="#ef4444"
                            dot={false}
                            strokeWidth={1.5}
                            connectNulls={false}
                        />
                        <Line
                            yAxisId="pct"
                            type="monotone"
                            dataKey="blocked_rate_pct"
                            name="Blocked rate"
                            stroke="#f59e0b"
                            dot={false}
                            strokeWidth={1.5}
                            connectNulls={false}
                        />
                        <Line
                            yAxisId="abs"
                            type="monotone"
                            dataKey="avg_latency_ms"
                            name="Avg latency"
                            stroke="#10b981"
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
