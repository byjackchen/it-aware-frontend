/**
 * Composite IoaScanCard — wraps the three group sub-components.
 * Reused on the scan-detail page and inside the Persona widget.
 */
'use client';

import type { IoaScanRead } from '@/lib/types/networks/ioa_scans';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { DeviceBlock } from './DeviceBlock';
import { KpiBlock } from './KpiBlock';
import { TrendChart } from './TrendChart';

export function IoaScanCard({ scan }: { scan: IoaScanRead }) {
    const { timezone } = useTimezone();
    return (
        <article className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-6">
            <header className="flex items-baseline justify-between">
                <h1 className="text-xl font-semibold">iOA Scan</h1>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(scan.scanned_at, timezone)} · {scan.trigger_source}
                </div>
            </header>
            <KpiBlock scan={scan} />
            <TrendChart scan={scan} />
            <DeviceBlock scan={scan} />
        </article>
    );
}
