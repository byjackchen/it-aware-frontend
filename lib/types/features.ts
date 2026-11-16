/**
 * Manage Features: the backend's answers (it-aware-backend specs/api_specs_features.md).
 */

export type Phase = 'planned' | 'add' | 'switch' | 'remove' | 'done';
export type EventKind = 'phase' | 'gate' | 'flag' | 'migration' | 'check' | 'note';

export interface Name {
  en: string;
  zh: string;
}

export interface Evidence {
  link?: string;
  text?: string;
  [key: string]: unknown;
}

export interface FeatureEvent {
  oid: string;
  feature: string;
  kind: EventKind;
  phase: string | null;
  gate: string | null;
  passed: boolean | null;
  flag: string | null;
  value: string | null;
  reason: string | null;
  evidence: Evidence | null;
  actor: string;
  release_commit: string | null;
  release_head: string | null;
  at: string;
}

export interface FlagState {
  code: string;
  name: Name;
  values: string[];
  old: string;
  new: string;
  value: string | null;
  changed_by: string | null;
  changed_at: string | null;
}

/**
 * A gate, judged by its check: passed when the check passed `days` days in a row
 * here up to its latest run (`streak` so far); false when that run failed; null
 * until then. `after_switch`: only runs after the flip to the new value count.
 * A gate is judged only in the environment it names (`where`); elsewhere
 * `judged_here` is false and it holds nothing.
 */
export interface GateState {
  code: string;
  before: string;
  name: Name;
  where: 'dev' | 'test' | 'prod';
  judged_here: boolean;
  check: string;
  days: number;
  after_switch: boolean;
  passed: boolean | null;
  streak: number;
  last: FeatureEvent | null;
}

export interface FeatureSummary {
  code: string;
  name: Name;
  description: Name;
  tapd: string | null;
  owner: string | null;
  phase: Phase;
  flags: FlagState[];
  gates_passed: number;
  gates_total: number;
  last_event_at: string | null;
}

export interface FeaturesResponse {
  features: FeatureSummary[];
}

export interface FeatureDetail extends FeatureSummary {
  /** This environment (IT_AWARE_ENV). */
  environment: string;
  revisions: { add: string[]; switch: string[]; remove: string[] };
  /** The revisions whose migration runs are recorded in this environment. */
  ran: string[];
  gates: GateState[];
  /** Each check and the manual Airflow job that runs it (check_<feature>_<check>). */
  checks: { code: string; job: string }[];
  events: FeatureEvent[];
}

export interface MigrationRun {
  oid: string;
  started: string;
  finished: string;
  revision_before: string | null;
  revision_after: string | null;
  outcome: string;
  commit: string | null;
}

export interface MigrationRunsResponse {
  items: MigrationRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface MigrationRunDetail extends MigrationRun {
  record: Record<string, unknown>;
}
