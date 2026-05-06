/**
 * "Run iOA scan now" button — calls the trigger endpoint and routes
 * to the new scan's detail page on success.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { triggerIoaScan } from '@/lib/api/networks/ioa_scans';

export function ScanTriggerButton({ workerOid }: { workerOid: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onClick() {
        setLoading(true);
        setError(null);
        try {
            const scan = await triggerIoaScan(workerOid);
            router.push(`/data/networks/ioa-scans/${scan.oid}`);
            router.refresh();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'scan failed');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <button
                type="button"
                onClick={onClick}
                disabled={loading}
                className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-50 hover:bg-blue-700"
            >
                {loading ? 'Scanning…' : 'Run iOA scan now'}
            </button>
            {error && <div className="text-xs text-red-500 mt-1">{error}</div>}
        </div>
    );
}
