/**
 * Server-side API client for the Systems module: the read-only Airflow
 * monitoring tab. (The LLM routing calls went with its pages, retired with the
 * task catalog v3.)
 */

import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { fetchApi } from '@/lib/api/core';
import type { AirflowDagsResponse } from '@/lib/types/systems';

const SYSTEMS_BASE = `${RUNTIME_CONFIG.backend.domain}/systems`;

// ── Airflow (read-only DAG monitoring) ───────────────────────────────────────
export async function getAirflowDags(): Promise<AirflowDagsResponse> {
  return fetchApi<AirflowDagsResponse>(`${SYSTEMS_BASE}/airflow/dags`);
}
