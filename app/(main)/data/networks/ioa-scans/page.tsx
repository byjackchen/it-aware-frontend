/**
 * iOA Scans master worker list.
 *
 * Server-rendered. Shows EVERY active worker (regardless of scan
 * history) joined with their latest scan summary. Each row links into
 * the worker's persona page where the user can drill into details or
 * trigger a fresh scan.
 *
 * UX: only fields a non-technical operator needs to glance at — name,
 * last-scan timestamp, and a few high-signal metrics. Internal
 * identifiers and dev-y fields stay on the detail page.
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
function fmtRelative(iso: string): string {
    const then = new Date(iso).getTime();
    const diffSec = Math.max(0, (Date.now() - then) / 1000);
    if (diffSec < 60) return `${Math.round(diffSec)}s ago`;
    if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
    return `${Math.round(diffSec / 86400)}d ago`;
}

export default async function IoaScansListPage() {
    const data = await listWorkersWithLatestScan({ limit: 200 });
    const withScan = data.items.filter((it) => it.latest_scan).length;

    return (
        <div className="p-6">
            <header className="mb-4">
                <h1 className="text-2xl font-semibold mb-1">iOA Scans</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Per-worker iOA telemetry summaries. Scans run daily and stay
                    available for 7 days. Click a worker to drill in or run an
                    on-demand scan.
                </p>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    {data.total} workers · {withScan} with a recent scan
                </div>
            </header>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr className="text-left">
                            <th className="py-2 px-3 font-medium">Worker</th>
                            <th className="py-2 px-3 font-medium">Last scan</th>
                            <th className="py-2 px-3 font-medium text-right">Connections (1h)</th>
                            <th className="py-2 px-3 font-medium text-right">Failure rate</th>
                            <th className="py-2 px-3 font-medium text-right">Devices</th>
                            <th className="py-2 px-3 font-medium"></th>
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
                                    <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                                        {scan ? (
                                            <Link
                                                className="hover:underline"
                                                href={`/data/networks/ioa-scans/${scan.oid}`}
                                                title={new Date(scan.scanned_at).toLocaleString()}
                                            >
                                                {fmtRelative(scan.scanned_at)}
                                            </Link>
                                        ) : (
                                            <span className="text-slate-400 italic">never</span>
                                        )}
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
