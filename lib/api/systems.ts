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
  LLMUsage,
  LLMUsageAggregateRow,
} from '@/lib/types/systems';

const BASE = `${RUNTIME_CONFIG.backend.domain}/systems/llm_proxy`;

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

// ── Usage metrics ─────────────────────────────────────────────────────────────
export async function getUsage(params?: {
  task_key?: string;
  model_name?: string;
  limit?: number;
}): Promise<LLMUsage[]> {
  const qs = new URLSearchParams();
  if (params?.task_key) qs.set('task_key', params.task_key);
  if (params?.model_name) qs.set('model_name', params.model_name);
  qs.set('limit', String(params?.limit ?? 100));
  return (await fetchApi<ListEnvelope<LLMUsage>>(`${BASE}/usage?${qs.toString()}`)).items;
}

export async function getUsageAggregate(): Promise<LLMUsageAggregateRow[]> {
  return (
    await fetchApi<{ rows: LLMUsageAggregateRow[] }>(`${BASE}/usage/aggregate`)
  ).rows;
}
