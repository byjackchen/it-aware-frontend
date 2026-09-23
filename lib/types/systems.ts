/**
 * Types for the Systems module — LLM Proxy task routing (models + routes).
 * Mirrors the backend Pydantic schemas in app/systems/llm_proxy/schemas.py.
 */

export interface LLMModel {
  oid: string;
  name: string;
  display_name: string | null;
  api_domain: string | null;
  temperature: number | null;
  top_p: number | null;
  max_tokens: number | null;
  thinking: boolean | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LLMModelCreate {
  name: string;
  display_name?: string | null;
  api_domain?: string | null;
  temperature?: number | null;
  top_p?: number | null;
  max_tokens?: number | null;
  thinking?: boolean | null;
}

export interface LLMModelUpdate extends Partial<LLMModelCreate> {
  is_active?: boolean;
}

export interface LLMRoute {
  oid: string;
  task_key: string;
  model_oid: string;
  model_name: string | null;
  temperature: number | null;
  top_p: number | null;
  max_tokens: number | null;
  thinking: boolean | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface LLMRouteCreate {
  task_key: string;
  model_oid: string;
  description?: string | null;
  temperature?: number | null;
  top_p?: number | null;
  max_tokens?: number | null;
  thinking?: boolean | null;
}

export interface LLMRouteUpdate {
  model_oid?: string;
  description?: string | null;
  temperature?: number | null;
  top_p?: number | null;
  max_tokens?: number | null;
  thinking?: boolean | null;
  is_active?: boolean;
}

/** A known logical task_key that real call sites pass to call_llm_v2. */
export interface TaskKeyInfo {
  task_key: string;
  description: string;
}

/** One DAG + its latest run, for the read-only Airflow monitoring tab. */
export interface AirflowDagSummary {
  dag_id: string;
  display_name: string;
  is_paused: boolean;
  has_import_errors: boolean;
  schedule: string | null;
  tags: string[];
  last_run_id: string | null;
  last_run_state: string | null;
  last_run_start: string | null;
  last_run_end: string | null;
  last_run_duration_s: number | null;
}

/** Fail-soft envelope: `available=false` when Airflow can't be reached. */
export interface AirflowDagsResponse {
  available: boolean;
  base_url_configured: boolean;
  dags: AirflowDagSummary[];
}

/** Result of a single live test call against a model (pre-switch guardrail). */
export interface LLMModelTestResult {
  ok: boolean;
  model_name: string;
  source: string; // "router" | "error"
  content: string | null;
  latency_ms: number | null;
  http_status: number | null;
  error: string | null;
}
