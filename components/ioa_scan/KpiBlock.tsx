/**
 * Network KPI block for IoaScanCard — three sub-sections:
 * volume/reliability, throughput, latency.
 */
import type { IoaScanRead } from '@/lib/types/networks/ioa_scans';

function fmtNum(n: number | null | undefined, digits = 0): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}
function fmtPct(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return `${(n * 100).toFixed(2)}%`;
}
function fmtBytes(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
    return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

export function KpiBlock({ scan }: { scan: IoaScanRead }) {
    const sampledNote =
        scan.kpi_sample_size != null &&
        scan.kpi_total_connections != null &&
        scan.kpi_sample_size < scan.kpi_total_connections
            ? `(stats over ${fmtNum(scan.kpi_sample_size)} of ${fmtNum(scan.kpi_total_connections)} sampled)`
            : null;

    return (
        <section>
            <h2 className="text-lg font-semibold mb-2">
                Network KPI · last 1 hour
                {sampledNote && (
                    <span className="text-xs text-slate-500 ml-2">{sampledNote}</span>
                )}
            </h2>

            <h3 className="text-sm font-medium text-slate-600 mt-2 mb-1">
                Volume &amp; reliability
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Total records" value={fmtNum(scan.kpi_total_records)} />
                <Stat label="Connections" value={fmtNum(scan.kpi_total_connections)} />
                <Stat label="Failed (HTTP ≠ 200)" value={fmtNum(scan.kpi_failed_connections)} />
                <Stat label="Failure rate" value={fmtPct(scan.kpi_failure_rate)} />
                <Stat label="Blocked (errorPage)" value={fmtNum(scan.kpi_blocked_count)} />
            </div>

            <h3 className="text-sm font-medium text-slate-600 mt-4 mb-1">
                Throughput (window-average)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Upload" value={`${fmtNum(scan.kpi_throughput_upload_kbps, 2)} KB/s`} />
                <Stat label="Download" value={`${fmtNum(scan.kpi_throughput_download_kbps, 2)} KB/s`} />
                <Stat label="Sample upload" value={fmtBytes(scan.kpi_sample_upload_bytes)} />
                <Stat label="Sample download" value={fmtBytes(scan.kpi_sample_download_bytes)} />
            </div>

            <h3 className="text-sm font-medium text-slate-600 mt-4 mb-1">
                Connection latency (ms)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Stat label="Avg connect" value={fmtNum(scan.kpi_avg_connect_ms, 1)} />
                <Stat label="P50 connect" value={fmtNum(scan.kpi_p50_connect_ms)} />
                <Stat label="P95 connect" value={fmtNum(scan.kpi_p95_connect_ms)} />
                <Stat label="Avg establish" value={fmtNum(scan.kpi_avg_establish_ms, 1)} />
                <Stat label="P95 establish" value={fmtNum(scan.kpi_p95_establish_ms)} />
            </div>
        </section>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="border border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/40 rounded p-2">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="text-lg font-mono">{value}</div>
        </div>
    );
}
