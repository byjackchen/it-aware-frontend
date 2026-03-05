/**
 * Server-side API client for Insights module (Analysis).
 */

import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { fetchApi } from '@/lib/api/core';
import type {
    Analysis,
    AnalysisListParams,
    AnalysisListResponse,
    AnalysisCreate,
    AnalysisUpdate,
} from '@/lib/types/objects';

const ANALYSISS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/insights/analysiss`;

function setOptionalQueryParam(query: URLSearchParams, key: string, value: string | number | undefined): void {
    if (value === undefined) return;
    const normalized = String(value).trim();
    if (normalized.length === 0) return;
    query.set(key, normalized);
}

// ============================================================================
// Analysis APIs
// ============================================================================

export async function getAnalysesPage(params: AnalysisListParams = {}): Promise<AnalysisListResponse> {
    const queryParams = new URLSearchParams();
    setOptionalQueryParam(queryParams, 'worker_oid', params.worker_oid);
    setOptionalQueryParam(queryParams, 'source_type', params.source_type);
    setOptionalQueryParam(queryParams, 'source_oid', params.source_oid);
    setOptionalQueryParam(queryParams, 'semantic', params.semantic);
    setOptionalQueryParam(queryParams, 'intent', params.intent);
    if (params.skip !== undefined) queryParams.set('skip', String(params.skip));
    if (params.limit !== undefined) queryParams.set('limit', String(params.limit));

    const queryString = queryParams.toString();
    const url = `${ANALYSISS_BASE}${queryString ? `?${queryString}` : ''}`;
    return fetchApi<AnalysisListResponse>(url);
}

export async function getAnalysis(oid: string): Promise<Analysis> {
    return fetchApi<Analysis>(`${ANALYSISS_BASE}/${encodeURIComponent(oid)}`);
}

export async function createAnalysis(data: AnalysisCreate): Promise<Analysis> {
    return fetchApi<Analysis>(ANALYSISS_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function updateAnalysis(oid: string, data: AnalysisUpdate): Promise<Analysis> {
    return fetchApi<Analysis>(`${ANALYSISS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function deleteAnalysis(oid: string): Promise<void> {
    return fetchApi<void>(`${ANALYSISS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}
