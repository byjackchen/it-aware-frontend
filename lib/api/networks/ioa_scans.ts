/**
 * Server-side API client for the iOA scan domain (Networks module).
 *
 * Server-only — uses fetchApi which reads cookies via next/headers.
 * Importing this module from a client component pulls cookies()/redirect()
 * into the client bundle and Turbopack fails the build.
 *
 * Other call paths intentionally bypass this module:
 *   - The worker list page uses useInfiniteResource → /api/objects/[resource]
 *     proxy, with `skip+limit` pagination.
 *   - PersonaIoaScanWidget and ScanTriggerButton are client components and
 *     fetch the /api/networks/ioa_scans/* proxy directly.
 */
import { fetchApi } from '@/lib/api/core';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { IoaScanRead } from '@/lib/types/networks/ioa_scans';

const IOA_SCANS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/networks/ioa_scans`;

export async function getIoaScan(oid: string): Promise<IoaScanRead> {
    return fetchApi<IoaScanRead>(`${IOA_SCANS_BASE}/${encodeURIComponent(oid)}`);
}
