/**
 * iOA Scans list page.
 *
 * Server-rendered. Each row links to the detail view.
 */

import Link from 'next/link';
import { listIoaScans } from '@/lib/api/networks/ioa_scans';

export const dynamic = 'force-dynamic';

export default async function IoaScansListPage() {
    const data = await listIoaScans({ limit: 50 });

    return (
        <div className="p-6">
            <h1 className="text-2xl font-semibold mb-1">iOA Scans</h1>
            <p className="text-sm text-slate-500 mb-4">
                Per-worker iOA telemetry summaries — Network KPI (1h),
                Trend (3d), and Device snapshots. Refreshed daily by the
                <code className="mx-1 px-1 rounded bg-slate-100">ioa_scan_periodic</code>
                DAG, or on demand from the Persona page.
            </p>
            <div className="text-xs text-slate-500 mb-2">{data.total} scans</div>

            {data.items.length === 0 ? (
                <div className="text-sm text-slate-500 border rounded p-4">
                    No scans yet. Run one from a worker&rsquo;s Persona page.
                </div>
            ) : (
                <table className="min-w-full text-sm border-collapse">
                    <thead>
                        <tr className="text-left border-b bg-slate-50">
                            <th className="py-2 px-3">Scanned at</th>
                            <th className="py-2 px-3">Worker</th>
                            <th className="py-2 px-3">Trigger</th>
                            <th className="py-2 px-3 text-right">Records (1h)</th>
                            <th className="py-2 px-3 text-right">Connections</th>
                            <th className="py-2 px-3 text-right">Failure rate</th>
                            <th className="py-2 px-3 text-right">Devices</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((s) => (
                            <tr key={s.oid} className="border-b hover:bg-slate-50">
                                <td className="py-2 px-3">
                                    <Link
                                        className="text-blue-600 hover:underline"
                                        href={`/data/networks/ioa-scans/${s.oid}`}
                                    >
                                        {new Date(s.scanned_at).toLocaleString()}
                                    </Link>
                                </td>
                                <td className="py-2 px-3 font-mono text-xs">{s.worker_oid}</td>
                                <td className="py-2 px-3">{s.trigger_source}</td>
                                <td className="py-2 px-3 text-right font-mono">
                                    {s.kpi_total_records?.toLocaleString() ?? '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                    {s.kpi_total_connections?.toLocaleString() ?? '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                    {s.kpi_failure_rate != null
                                        ? `${(s.kpi_failure_rate * 100).toFixed(2)}%`
                                        : '—'}
                                </td>
                                <td className="py-2 px-3 text-right font-mono">
                                    {s.device_count ?? '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
