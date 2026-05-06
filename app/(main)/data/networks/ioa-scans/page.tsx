/**
 * iOA Scans master worker list.
 *
 * Server-rendered. Shows EVERY active worker (regardless of scan
 * history) joined with their latest scan summary. Each row links into
 * the worker's persona page where the user can drill into details or
 * trigger a fresh scan.
 */

import Link from 'next/link';
import { listWorkersWithLatestScan } from '@/lib/api/networks/ioa_scans';
import { ScanTriggerButton } from '@/components/ioa_scan/ScanTriggerButton';

export const dynamic = 'force-dynamic';

function fmtNum(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return n.toLocaleString();
}
function fmtPct(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    return `${(n * 100).toFixed(1)}%`;
}

export default async function IoaScansListPage() {
    const data = await listWorkersWithLatestScan({ limit: 200 });
    const withScan = data.items.filter((it) => it.latest_scan).length;

    return (
        <div className="p-6">
            <header className="mb-4">
                <h1 className="text-2xl font-semibold mb-1">iOA Scans</h1>
                <p className="text-sm text-slate-500">
                    Per-worker iOA telemetry summaries — Network KPI (1h),
                    Trend (3d), and Device snapshots. Refreshed daily by the
                    <code className="mx-1 px-1 rounded bg-slate-100 dark:bg-slate-800">
                        ioa_scan_periodic
                    </code>
                    DAG (retention 7 days), or on demand from any row below.
                </p>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {data.total} active workers · {withScan} with a scan · {data.total - withScan} unscanned
                </div>
            </header>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr className="text-left">
                            <th className="py-2 px-3 font-medium">Worker</th>
                            <th className="py-2 px-3 font-medium">Stable ID</th>
                            <th className="py-2 px-3 font-medium">Latest scan</th>
                            <th className="py-2 px-3 font-medium text-right">Records (1h)</th>
                            <th className="py-2 px-3 font-medium text-right">Connections</th>
                            <th className="py-2 px-3 font-medium text-right">Failure rate</th>
                            <th className="py-2 px-3 font-medium text-right">Devices</th>
                            <th className="py-2 px-3 font-medium">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((row) => {
                            const scan = row.latest_scan;
                            return (
                                <tr
                                    key={row.worker_oid}
                                    className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                >
                                    <td className="py-2 px-3">
                                        <Link
                                            className="text-blue-600 dark:text-blue-400 hover:underline"
                                            href={`/persona/${encodeURIComponent(row.worker_oid)}`}
                                        >
                                            {row.worker_fullname}
                                        </Link>
                                    </td>
                                    <td className="py-2 px-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                                        {row.worker_stable_id ?? '—'}
                                    </td>
                                    <td className="py-2 px-3">
                                        {scan ? (
                                            <Link
                                                className="text-slate-700 dark:text-slate-200 hover:underline"
                                                href={`/data/networks/ioa-scans/${scan.oid}`}
                                            >
                                                {new Date(scan.scanned_at).toLocaleString()}
                                                <span className="ml-2 inline-block text-[10px] uppercase tracking-wide text-slate-500">
                                                    {scan.trigger_source}
                                                </span>
                                            </Link>
                                        ) : (
                                            <span className="text-slate-400 italic">never</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono">
                                        {fmtNum(scan?.kpi_total_records)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono">
                                        {fmtNum(scan?.kpi_total_connections)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono">
                                        {fmtPct(scan?.kpi_failure_rate)}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono">
                                        {fmtNum(scan?.device_count)}
                                    </td>
                                    <td className="py-2 px-3">
                                        <ScanTriggerButton workerOid={row.worker_oid} />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
