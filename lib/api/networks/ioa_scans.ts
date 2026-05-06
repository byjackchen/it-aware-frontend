/**
 * Server-side API client for the iOA scan domain (Networks module).
 *
 * Server-rendered functions (`listIoaScans`, `getIoaScan`,
 * `getLatestIoaScanForWorker`) call the backend directly via fetchApi —
 * matches the lib/api/objects.ts convention.
 *
 * The mutation `triggerIoaScan()` is intended for client components and
 * goes through the Next.js proxy at /api/networks/ioa_scans/scan/{oid}.
 */
import { fetchApi } from '@/lib/api/core';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { IoaScanList, IoaScanRead } from '@/lib/types/networks/ioa_scans';

const IOA_SCANS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/networks/ioa_scans`;

// ── Server-side reads (RSC) ──────────────────────────────────────────

export async function listIoaScans(
    params: { worker_oid?: string; page?: number; limit?: number } = {}
): Promise<IoaScanList> {
    const qs = new URLSearchParams();
    if (params.worker_oid) qs.set('worker_oid', params.worker_oid);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const url = `${IOA_SCANS_BASE}/${qs.toString() ? `?${qs}` : ''}`;
    return fetchApi<IoaScanList>(url);
}

export async function getIoaScan(oid: string): Promise<IoaScanRead> {
    return fetchApi<IoaScanRead>(`${IOA_SCANS_BASE}/${encodeURIComponent(oid)}`);
}

export async function getLatestIoaScanForWorker(
    workerOid: string,
): Promise<IoaScanRead | null> {
    try {
        return await fetchApi<IoaScanRead>(
            `${IOA_SCANS_BASE}/by-worker/${encodeURIComponent(workerOid)}/latest`,
        );
    } catch (e: unknown) {
        if ((e as { status?: number })?.status === 404) return null;
        throw e;
    }
}

// ── Client-side mutation (browser → /api proxy → backend) ────────────

export async function triggerIoaScan(workerOid: string): Promise<IoaScanRead> {
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
