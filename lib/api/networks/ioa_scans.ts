/**
 * Server-side API client for the iOA scan domain (Networks module).
 *
 * These functions call the backend directly via fetchApi (uses
 * `next/headers` cookies) — matches the lib/api/objects.ts convention.
 * They are server-only; importing this module from a client component
 * pulls cookies()/redirect() into the client bundle and Turbopack fails
 * the build. The trigger mutation is inlined inside ScanTriggerButton.tsx.
 */
import { fetchApi } from '@/lib/api/core';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type {
    IoaScanList,
    IoaScanRead,
    WorkerWithLatestScanList,
} from '@/lib/types/networks/ioa_scans';

const IOA_SCANS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/networks/ioa_scans`;

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

export async function listWorkersWithLatestScan(
    params: { page?: number; limit?: number } = {}
): Promise<WorkerWithLatestScanList> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const url = `${IOA_SCANS_BASE}/workers-with-latest${qs.toString() ? `?${qs}` : ''}`;
    return fetchApi<WorkerWithLatestScanList>(url);
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
