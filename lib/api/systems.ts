/**
 * Server-side API client for the Systems module (LLM Proxy config).
 * Backend domain: /systems/llm_proxy/...
 */

import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { fetchApi } from '@/lib/api/core';
import type {
  LLMModel,
  LLMModelCreate,
  LLMModelUpdate,
  LLMRoute,
  LLMRouteCreate,
  LLMRouteUpdate,
  AirflowDagsResponse,
  LLMModelTestResult,
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

// ── Airflow (read-only DAG monitoring) ───────────────────────────────────────
export async function getAirflowDags(): Promise<AirflowDagsResponse> {
  return fetchApi<AirflowDagsResponse>(`${SYSTEMS_BASE}/airflow/dags`);
}
