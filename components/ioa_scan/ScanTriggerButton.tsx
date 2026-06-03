/**
 * "Run iOA scan now" button.
 *
 * Default behavior: navigate to the new scan's detail page on success.
 * Pass `onSuccess` to override — used by PersonaIoaScanWidget so a
 * Persona-page click refreshes the inline card in place instead of
 * navigating the user away from the worker they were looking at.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IoaScanRead } from '@/lib/types/networks/ioa_scans';

async function postScan(workerOid: string): Promise<IoaScanRead> {
    const res = await fetch(
        `/api/networks/ioa_scans/scan/${encodeURIComponent(workerOid)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
            credentials: 'include',
        },
    );
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`scan failed: ${res.status} ${body}`);
    }
    return res.json();
}

export function ScanTriggerButton({
    workerOid,
    onSuccess,
}: {
    workerOid: string;
    onSuccess?: (scan: IoaScanRead) => void | Promise<void>;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onClick() {
        setLoading(true);
        setError(null);
        try {
            const scan = await postScan(workerOid);
            if (onSuccess) {
                await onSuccess(scan);
            } else {
                router.push(`/data/networks/ioa-scans/${scan.oid}`);
                router.refresh();
            }
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
            {error && <div className="text-xs text-red-500 dark:text-red-400 mt-1">{error}</div>}
        </div>
    );
}
