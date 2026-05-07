/**
 * Network KPI block — four key metrics in comparable units:
 *   - Connections / hour (rate)
 *   - Failure rate (% of connections)
 *   - Blocked rate (% of connections)
 *   - Avg latency (ms)
 *
 * Throughput + sample-level details live behind the Advanced disclosure.
 */
import type { IoaScanRead } from '@/lib/types/networks/ioa_scans';

const KPI_WINDOW_HOURS = 24;

function fmtNum(n: number | null | undefined, digits = 0): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function fmtPct(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return `${(n * 100).toFixed(2)}%`;
}
function rate(num: number | null | undefined, denom: number | null | undefined): number | null {
    if (num === null || num === undefined || !denom) return null;
    return num / denom;
}

export function KpiBlock({ scan }: { scan: IoaScanRead }) {
    const connectionsPerHour =
        scan.kpi_total_connections != null
            ? scan.kpi_total_connections / KPI_WINDOW_HOURS
            : null;
    const blockedRate = rate(scan.kpi_blocked_count, scan.kpi_total_connections);

    return (
        <section>
            <h2 className="text-lg font-semibold mb-2">Network · Last 24 Hours</h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Connections / h" value={fmtNum(connectionsPerHour, 1)} />
                <Stat label="Failure rate" value={fmtPct(scan.kpi_failure_rate)} />
                <Stat label="Blocked rate" value={fmtPct(blockedRate)} />
                <Stat
                    label="Avg latency"
                    value={
                        scan.kpi_avg_connect_ms != null
                            ? `${fmtNum(scan.kpi_avg_connect_ms, 0)} ms`
                            : '—'
                    }
                />
            </div>

            <details className="mt-3">
                <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200">
                    Advanced details
                </summary>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Stat label="Total records" value={fmtNum(scan.kpi_total_records)} />
                    <Stat label="Total connections" value={fmtNum(scan.kpi_total_connections)} />
                    <Stat label="Failed connections" value={fmtNum(scan.kpi_failed_connections)} />
                    <Stat label="Blocked count" value={fmtNum(scan.kpi_blocked_count)} />
                    <Stat
                        label="Download speed"
                        value={`${fmtNum(scan.kpi_throughput_download_kbps, 1)} KB/s`}
                    />
                    <Stat
                        label="Upload speed"
                        value={`${fmtNum(scan.kpi_throughput_upload_kbps, 1)} KB/s`}
                    />
                    <Stat label="P50 connect (ms)" value={fmtNum(scan.kpi_p50_connect_ms)} />
                    <Stat label="P95 connect (ms)" value={fmtNum(scan.kpi_p95_connect_ms)} />
                    <Stat label="Avg establish (ms)" value={fmtNum(scan.kpi_avg_establish_ms, 1)} />
                    <Stat label="P95 establish (ms)" value={fmtNum(scan.kpi_p95_establish_ms)} />
                    <Stat label="Sample size" value={fmtNum(scan.kpi_sample_size)} />
                </div>
            </details>
        </section>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="border border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/40 rounded p-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
            <div className="text-lg font-mono">{value}</div>
        </div>
    );
}
