/**
 * View IT CSAT (backend `GET /csat/responses`, specs/backend/api_specs_csat.md) and
 * View Raw Records (backend `GET /raw/{source}/records`,
 * specs/backend/api_specs_raw_records.md).
 */

export interface CsatResponse {
  oid: string;
  /** ServiceNow's survey (assessment instance) number. */
  external_id: string;
  incident_number: string | null;
  status: string;
  submitted_at: string | null;
  source_taken_on: string | null;
  survey_questions: unknown;
  survey_answer: unknown;
  /** The raw source the row was derived from. */
  raw_source: string;
  derived_at: string;
}

export interface CsatResponses {
  items: CsatResponse[];
  total: number;
}

export interface RawRecord {
  source_key: string;
  received_at: string;
  source_time: string | null;
  source_updated_at: string | null;
  /** The source's full list no longer holds the key. */
  deleted: boolean;
  /** The record as the source's reader names it; null when deleted. */
  fields: Record<string, unknown> | null;
}

export interface RawRecords {
  source: string;
  /** The reader's field names, in the order to show them. */
  fields: string[];
  items: RawRecord[];
  /** Keys of the source (matching `key` when given). */
  total: number;
  /** Null on the last page. */
  next_cursor: string | null;
}
