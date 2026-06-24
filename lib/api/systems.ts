/**
 * Server-side API client for the Systems module (LLM Proxy config).
 * Backend domain: /systems/llm_proxy/...
 */

import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { fetchApi } from '@/lib/api/core';
import type {
  LLMKey,
  LLMKeyCreate,
  LLMKeyUpdate,
  LLMModel,
  LLMModelCreate,
  LLMModelUpdate,
  LLMRoute,
  LLMRouteCreate,
  LLMRouteUpdate,
  AirflowDagsResponse,
  LLMModelTestResult,
  LLMUsage,
  LLMUsageAggregateRow,
  TaskKeyInfo,
} from '@/lib/types/systems';

const BASE = `${RUNTIME_CONFIG.backend.domain}/systems/llm_proxy`;
const SYSTEMS_BASE = `${RUNTIME_CONFIG.backend.domain}/systems`;

interface ListEnvelope<T> {
  items: T[];
  total: number;
}

// ── Models ──────────────────────────────────────────────────────────────────
export async function getModels(): Promise<LLMModel[]> {
  return (await fetchApi<ListEnvelope<LLMModel>>(`${BASE}/models`)).items;
}

export async function getModel(oid: string): Promise<LLMModel> {
  return fetchApi<LLMModel>(`${BASE}/models/${encodeURIComponent(oid)}`);
}

export async function createModel(data: LLMModelCreate): Promise<LLMModel> {
  return fetchApi<LLMModel>(`${BASE}/models`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateModel(oid: string, data: LLMModelUpdate): Promise<LLMModel> {
  return fetchApi<LLMModel>(`${BASE}/models/${encodeURIComponent(oid)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteModel(oid: string): Promise<void> {
  return fetchApi<void>(`${BASE}/models/${encodeURIComponent(oid)}`, { method: 'DELETE' });
}

/** Fire one live test call at a model; result gates a route's model switch. */
export async function testModel(oid: string): Promise<LLMModelTestResult> {
  return fetchApi<LLMModelTestResult>(`${BASE}/models/${encodeURIComponent(oid)}/test`, {
    method: 'POST',
  });
}

// ── Keys ────────────────────────────────────────────────────────────────────
export async function getKeys(modelOid?: string): Promise<LLMKey[]> {
  const qs = modelOid ? `?model_oid=${encodeURIComponent(modelOid)}` : '';
  return (await fetchApi<ListEnvelope<LLMKey>>(`${BASE}/keys${qs}`)).items;
}

export async function createKey(data: LLMKeyCreate): Promise<LLMKey> {
  return fetchApi<LLMKey>(`${BASE}/keys`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateKey(oid: string, data: LLMKeyUpdate): Promise<LLMKey> {
  return fetchApi<LLMKey>(`${BASE}/keys/${encodeURIComponent(oid)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteKey(oid: string): Promise<void> {
  return fetchApi<void>(`${BASE}/keys/${encodeURIComponent(oid)}`, { method: 'DELETE' });
}

// ── Routes (task_key → model) ─────────────────────────────────────────────────
export async function getRoutes(): Promise<LLMRoute[]> {
  return (await fetchApi<ListEnvelope<LLMRoute>>(`${BASE}/routes`)).items;
}

export async function createRoute(data: LLMRouteCreate): Promise<LLMRoute> {
  return fetchApi<LLMRoute>(`${BASE}/routes`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateRoute(oid: string, data: LLMRouteUpdate): Promise<LLMRoute> {
  return fetchApi<LLMRoute>(`${BASE}/routes/${encodeURIComponent(oid)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRoute(oid: string): Promise<void> {
  return fetchApi<void>(`${BASE}/routes/${encodeURIComponent(oid)}`, { method: 'DELETE' });
}

// ── Known task keys (Routes UI picker) ────────────────────────────────────────
export async function getTaskKeys(): Promise<TaskKeyInfo[]> {
  return (await fetchApi<ListEnvelope<TaskKeyInfo>>(`${BASE}/task-keys`)).items;
}

// ── Usage metrics ─────────────────────────────────────────────────────────────
export interface UsageFilters {
  task_key?: string;
  model_name?: string;
  status?: string;
  window_hours?: number;
  created_from?: string;
  created_to?: string;
}

function usageQs(f?: UsageFilters): URLSearchParams {
  const qs = new URLSearchParams();
  if (f?.task_key) qs.set('task_key', f.task_key);
  if (f?.model_name) qs.set('model_name', f.model_name);
  if (f?.status) qs.set('status', f.status);
  if (f?.window_hours) qs.set('window_hours', String(f.window_hours));
  if (f?.created_from) qs.set('created_from', f.created_from);
  if (f?.created_to) qs.set('created_to', f.created_to);
  return qs;
}

export async function getUsage(params?: UsageFilters & { limit?: number }): Promise<LLMUsage[]> {
  const qs = usageQs(params);
  qs.set('limit', String(params?.limit ?? 100));
  return (await fetchApi<ListEnvelope<LLMUsage>>(`${BASE}/usage?${qs.toString()}`)).items;
}

/** Count usage rows matching the filters (reads the list envelope `total`). */
export async function getUsageCount(params?: UsageFilters): Promise<number> {
  const qs = usageQs(params);
  qs.set('limit', '1');
  return (await fetchApi<ListEnvelope<LLMUsage>>(`${BASE}/usage?${qs.toString()}`)).total;
}

export async function getUsageAggregate(params?: UsageFilters): Promise<LLMUsageAggregateRow[]> {
  const s = usageQs(params).toString();
  return (
    await fetchApi<{ rows: LLMUsageAggregateRow[] }>(`${BASE}/usage/aggregate${s ? `?${s}` : ''}`)
  ).rows;
}

/** Delete usage rows matching the filters; no filters → clear all. */
export async function clearUsage(params?: UsageFilters): Promise<{ deleted: number }> {
  const qs = usageQs(params);
  // The backend refuses an unfiltered (whole-table) clear unless confirm=all.
  if ([...qs.keys()].length === 0) qs.set('confirm', 'all');
  const s = qs.toString();
  return fetchApi<{ deleted: number }>(`${BASE}/usage${s ? `?${s}` : ''}`, { method: 'DELETE' });
}

// ── Airflow (read-only DAG monitoring) ───────────────────────────────────────
export async function getAirflowDags(): Promise<AirflowDagsResponse> {
  return fetchApi<AirflowDagsResponse>(`${SYSTEMS_BASE}/airflow/dags`);
}
