/**
 * Persona-page widget — fetches the latest iOA scan for the active worker
 * and renders an IoaScanCard plus a Re-scan button.
 *
 * Self-contained client component. Server-side reads in lib/api/networks
 * use fetchApi (cookies); from a client component we go through the
 * Next.js proxy at /api/networks/ioa_scans/*.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { IoaScanRead } from '@/lib/types/networks/ioa_scans';
import { IoaScanCard } from './IoaScanCard';
import { ScanTriggerButton } from './ScanTriggerButton';

async function fetchLatestScan(workerOid: string): Promise<IoaScanRead | null> {
    const res = await fetch(
        `/api/networks/ioa_scans/by-worker/${encodeURIComponent(workerOid)}/latest`,
        { credentials: 'include', cache: 'no-store' },
    );
    if (res.status === 404) return null;
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`failed to load scan: ${res.status} ${body}`);
    }
    return res.json();
}

type LoadState =
    | { kind: 'loading' }
    | { kind: 'empty' }
    | { kind: 'loaded'; scan: IoaScanRead }
    | { kind: 'error'; message: string };

export function PersonaIoaScanWidget({ workerOid }: { workerOid: string }) {
    const [state, setState] = useState<LoadState>({ kind: 'loading' });

    const load = useCallback(async () => {
        try {
            const scan = await fetchLatestScan(workerOid);
            setState(scan ? { kind: 'loaded', scan } : { kind: 'empty' });
        } catch (e) {
            setState({
                kind: 'error',
                message: e instanceof Error ? e.message : 'unknown error',
            });
        }
    }, [workerOid]);

    useEffect(() => {
        void load();
    }, [load]);

    return (
        <section className="my-6">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">iOA Snapshot</h2>
                {/* Persona-page click should not navigate away — apply the
                    fresh scan into our own state so the card refreshes in place. */}
                <ScanTriggerButton
                    workerOid={workerOid}
                    onSuccess={(scan) => setState({ kind: 'loaded', scan })}
                />
            </div>

            {state.kind === 'loading' && (
                <div className="text-sm text-slate-500 border rounded p-4">Loading…</div>
            )}
            {state.kind === 'empty' && (
                <div className="text-sm text-slate-500 border rounded p-4">
                    No scan yet for this worker. Click &ldquo;Run iOA scan now&rdquo; above.
                </div>
            )}
            {state.kind === 'error' && (
                <div className="text-sm text-red-500 border border-red-200 rounded p-4">
                    {state.message}
                </div>
            )}
            {state.kind === 'loaded' && <IoaScanCard scan={state.scan} />}
        </section>
    );
}
