/**
 * "Run iOA scan now" button — calls the trigger endpoint and routes
 * to the new scan's detail page on success.
 */
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IoaScanRead } from '@/lib/types/networks/ioa_scans';

async function triggerIoaScan(workerOid: string): Promise<IoaScanRead> {
    // Inlined here (not imported from lib/api/networks/ioa_scans) so this
    // client component's bundle never touches lib/api/core.ts, which uses
    // next/headers and blows up Turbopack's client build.
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
