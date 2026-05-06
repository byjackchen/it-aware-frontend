/**
 * 3-day trend line chart for IoaScanCard. Client component (recharts).
 */
'use client';

import {
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { IoaScanRead } from '@/lib/types/networks/ioa_scans';

export function TrendChart({ scan }: { scan: IoaScanRead }) {
    const data = (scan.trend_hourly_counts ?? []).map((b) => ({
        ts: new Date(b.ts).toLocaleString(),
        count: b.count,
    }));

    return (
        <section>
            <h2 className="text-lg font-semibold mb-2">
                Network KPI Trend · last {scan.trend_window_hours} hours
            </h2>
            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <XAxis dataKey="ts" hide />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="count" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="text-xs text-slate-500 mt-1">
                peak: {scan.trend_peak_hour_count ?? '—'} ·
                offline minutes: {scan.trend_offline_minutes ?? '—'}
            </div>
        </section>
    );
}
