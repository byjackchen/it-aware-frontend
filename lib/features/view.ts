/**
 * Manage Features: where its pages live and how a page picks its screen. It only
 * controls feature flags (the backend's rules: app/features/service.py).
 *
 *   /tasks/features/features                    every feature
 *   /tasks/features/features?feature=<code>     one feature
 *   /tasks/features/migrations[?page=<n>]       the migration runs
 *   /tasks/features/migrations?run=<oid>        one run's record
 */


export const FEATURES_BASE = '/tasks/features/features';
export const MIGRATIONS_BASE = '/tasks/features/migrations';
export const RUNS_PAGE_SIZE = 50;
export const FEATURES_EDIT_PERMISSION = 'systems:features:edit';

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string): string | null {
  const value = params[key];
  const text = Array.isArray(value) ? value[0] : value;
  return text ? text : null;
}

export function featureHref(code?: string): string {
  return code ? `${FEATURES_BASE}?feature=${encodeURIComponent(code)}` : FEATURES_BASE;
}

export function migrationsHref(options: { page?: number; run?: string } = {}): string {
  if (options.run) return `${MIGRATIONS_BASE}?run=${encodeURIComponent(options.run)}`;
  return options.page && options.page > 1 ? `${MIGRATIONS_BASE}?page=${options.page}` : MIGRATIONS_BASE;
}

export function parseFeaturesView(params: Params): { feature: string | null } {
  return { feature: one(params, 'feature') };
}

export function parseMigrationsView(params: Params): { run: string | null; page: number } {
  const page = Number(one(params, 'page'));
  return { run: one(params, 'run'), page: Number.isInteger(page) && page > 1 ? page : 1 };
}

/** A name in the page's language. */
export function named(name: { en: string; zh: string }, locale: string): string {
  return locale.startsWith('zh') ? name.zh : name.en;
}
