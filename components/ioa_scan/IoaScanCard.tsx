/**
 * Composite IoaScanCard — wraps the three group sub-components.
 * Reused on the scan-detail page and inside the Persona widget.
 */
import type { IoaScanRead } from '@/lib/types/networks/ioa_scans';
import { DeviceBlock } from './DeviceBlock';
import { KpiBlock } from './KpiBlock';
import { TrendChart } from './TrendChart';

export function IoaScanCard({ scan }: { scan: IoaScanRead }) {
    return (
        <article className="rounded-lg border bg-white shadow-sm p-4 space-y-6">
            <header className="flex items-baseline justify-between">
                <h1 className="text-xl font-semibold">iOA Scan</h1>
                <div className="text-xs text-slate-500">
                    {new Date(scan.scanned_at).toLocaleString()} · {scan.trigger_source}
                </div>
            </header>
            <KpiBlock scan={scan} />
            <TrendChart scan={scan} />
            <DeviceBlock scan={scan} />
        </article>
    );
}
