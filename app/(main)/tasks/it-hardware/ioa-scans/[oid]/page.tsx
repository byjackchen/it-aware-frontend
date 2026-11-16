/**
 * iOA scan detail page — renders all three KPI groups + a re-scan button.
 */
import { notFound } from 'next/navigation';
import { getIoaScan } from '@/lib/api/networks/ioa_scans';
import { IoaScanCard } from '@/components/ioa_scan/IoaScanCard';
import { ScanTriggerButton } from '@/components/ioa_scan/ScanTriggerButton';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export default async function IoaScanDetailPage({
    params,
}: {
    params: Promise<{ oid: string }>;
}) {
    const { oid } = await params;

    let scan;
    try {
        scan = await getIoaScan(oid);
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
            notFound();
        }
        throw e;
    }

    return (
        <div className="p-6 space-y-4 max-w-5xl">
            <ScanTriggerButton workerOid={scan.worker_oid} />
            <IoaScanCard scan={scan} />
        </div>
    );
}
