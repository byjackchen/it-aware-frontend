/**
 * Server-side API client for Journeys module (Scenarios).
 */

import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { fetchApi } from '@/lib/api/core';
import type {
    Scenario,
    ScenarioListParams,
    ScenarioListResponse,
    ScenarioCreate,
    ScenarioUpdate,
} from '@/lib/types/objects';

const SCENARIOS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/journeys/scenarios`;

function setOptionalQueryParam(query: URLSearchParams, key: string, value: string | number | undefined): void {
    if (value === undefined) return;
    const normalized = String(value).trim();
    if (normalized.length === 0) return;
    query.set(key, normalized);
}

// ============================================================================
// Scenario APIs
// ============================================================================

export async function getScenariosPage(params: ScenarioListParams = {}): Promise<ScenarioListResponse> {
    const queryParams = new URLSearchParams();
    setOptionalQueryParam(queryParams, 'worker_oid', params.worker_oid);
    setOptionalQueryParam(queryParams, 'scenario_type', params.scenario_type);
    setOptionalQueryParam(queryParams, 'effective_at_from', params.effective_at_from);
    setOptionalQueryParam(queryParams, 'effective_at_to', params.effective_at_to);
    if (params.skip !== undefined) queryParams.set('skip', String(params.skip));
    if (params.limit !== undefined) queryParams.set('limit', String(params.limit));

    const queryString = queryParams.toString();
    const url = `${SCENARIOS_BASE}${queryString ? `?${queryString}` : ''}`;
    return fetchApi<ScenarioListResponse>(url);
}

export async function getScenario(oid: string): Promise<Scenario> {
    return fetchApi<Scenario>(`${SCENARIOS_BASE}/${encodeURIComponent(oid)}`);
}

export async function createScenario(data: ScenarioCreate): Promise<Scenario> {
    return fetchApi<Scenario>(SCENARIOS_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function updateScenario(oid: string, data: ScenarioUpdate): Promise<Scenario> {
    return fetchApi<Scenario>(`${SCENARIOS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function deleteScenario(oid: string): Promise<void> {
    return fetchApi<void>(`${SCENARIOS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}
