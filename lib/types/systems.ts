/**
 * Types for the Systems module — LLM Proxy configuration.
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
  total_qpm: number;
  active_key_count: number;
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

export interface LLMKey {
  oid: string;
  model_oid: string;
  label: string;
  secret_masked: string;
  qpm: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LLMKeyCreate {
  model_oid: string;
  label: string;
  secret: string;
  qpm: number;
}

export interface LLMKeyUpdate {
  label?: string;
  secret?: string;
  qpm?: number;
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

export interface LLMUsage {
  oid: string;
  task_key: string | null;
  model_name: string | null;
  key_label: string | null;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  latency_ms: number | null;
  status: string;
  http_status: number | null;
  error: string | null;
  created_at: string;
}

export interface LLMUsageAggregateRow {
  task_key: string | null;
  model_name: string | null;
  calls: number;
  errors: number;
  input_tokens: number;
  output_tokens: number;
  cached_tokens: number;
  avg_latency_ms: number | null;
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
  source: string; // "v2" | "v1_fallback" | "error"
  key_label: string | null;
  content: string | null;
  latency_ms: number | null;
  http_status: number | null;
  error: string | null;
}
