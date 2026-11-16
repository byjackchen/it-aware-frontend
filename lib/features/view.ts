/**
 * Manage Features: where its pages live, how a page picks its screen, and the
 * small rules the screens show (the backend enforces them; app/features/lifecycle.py).
 *
 *   /tasks/features/features                    every feature
 *   /tasks/features/features?feature=<code>     one feature
 *   /tasks/features/migrations[?page=<n>]       the migration runs
 *   /tasks/features/migrations?run=<oid>        one run's record
 */

import type { FeatureDetail, Phase } from '@/lib/types/features';

export const FEATURES_BASE = '/tasks/features/features';
export const MIGRATIONS_BASE = '/tasks/features/migrations';
export const RUNS_PAGE_SIZE = 50;
export const FEATURES_EDIT_PERMISSION = 'systems:features:edit';

/** The phases in order: add (expand), switch (migrate), remove (contract). */
export const PHASES: Phase[] = ['planned', 'add', 'switch', 'remove', 'done'];

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

/** Where a phase stands for the strip: done, the current one, or still ahead. */
export function phaseState(current: Phase, phase: Phase): 'done' | 'current' | 'ahead' {
  const [at, of] = [PHASES.indexOf(current), PHASES.indexOf(phase)];
  return of < at ? 'done' : of === at ? 'current' : 'ahead';
}

/** Whether a flag may still be flipped: until one of the remove revisions has run. */
export function canFlip(feature: Pick<FeatureDetail, 'revisions' | 'ran'>): boolean {
  return !feature.revisions.remove.some((r) => feature.ran.includes(r));
}

/**
 * The gates a flip to a flag's new value would override: flipping to `new` is the
 * switch, so the gates due before it must have passed (none once switched).
 */
export function switchGatesOpen(feature: Pick<FeatureDetail, 'phase' | 'gates'>): string[] {
  if (PHASES.indexOf(feature.phase) >= PHASES.indexOf('switch')) return [];
  return feature.gates.filter((g) => g.before === 'switch' && !g.passed).map((g) => g.code);
}

/** A name in the page's language. */
export function named(name: { en: string; zh: string }, locale: string): string {
  return locale.startsWith('zh') ? name.zh : name.en;
}
