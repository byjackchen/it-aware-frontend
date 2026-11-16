/**
 * Manage Features: the backend's answers (it-aware-backend specs/api_specs_features.md).
 * It only controls feature flags; a change's add, switch and remove are written in
 * it-aware-backend docs/feature-lifecycle.md.
 */

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
  value: string | null;
  changed_by: string | null;
  changed_at: string | null;
}

export interface FeatureSummary {
  code: string;
  name: Name;
  description: Name;
  tapd: string | null;
  owner: string | null;
  flags: FlagState[];
  last_flip_at: string | null;
}

export interface FeaturesResponse {
  features: FeatureSummary[];
}

export interface FeatureDetail extends FeatureSummary {
  /** The feature's flips, newest first. */
  flips: FeatureEvent[];
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
