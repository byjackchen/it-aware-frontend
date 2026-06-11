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
export async function getUsage(params?: {
  task_key?: string;
  model_name?: string;
  window_hours?: number;
  limit?: number;
}): Promise<LLMUsage[]> {
  const qs = new URLSearchParams();
  if (params?.task_key) qs.set('task_key', params.task_key);
  if (params?.model_name) qs.set('model_name', params.model_name);
  if (params?.window_hours) qs.set('window_hours', String(params.window_hours));
  qs.set('limit', String(params?.limit ?? 100));
  return (await fetchApi<ListEnvelope<LLMUsage>>(`${BASE}/usage?${qs.toString()}`)).items;
}

export async function getUsageAggregate(windowHours?: number): Promise<LLMUsageAggregateRow[]> {
  const qs = windowHours ? `?window_hours=${windowHours}` : '';
  return (
    await fetchApi<{ rows: LLMUsageAggregateRow[] }>(`${BASE}/usage/aggregate${qs}`)
  ).rows;
}

// ── Airflow (read-only DAG monitoring) ───────────────────────────────────────
export async function getAirflowDags(): Promise<AirflowDagsResponse> {
  return fetchApi<AirflowDagsResponse>(`${SYSTEMS_BASE}/airflow/dags`);
}
