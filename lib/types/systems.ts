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
