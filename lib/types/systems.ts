/**
 * Types for the Systems module: the read-only Airflow monitoring tab. (The LLM
 * routing types went with its pages, retired with the task catalog v3.)
 */

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
