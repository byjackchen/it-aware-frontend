/**
 * Manage Features: where its pages live and how a page picks its screen. It only
 * controls feature flags (the backend's rules: app/features/service.py).
 *
 *   /tasks/features                    every feature
 *   /tasks/features?feature=<code>     one feature
 */


export const FEATURES_BASE = '/tasks/features';
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

export function parseFeaturesView(params: Params): { feature: string | null } {
  return { feature: one(params, 'feature') };
}

/** A name in the page's language. */
export function named(name: { en: string; zh: string }, locale: string): string {
  return locale.startsWith('zh') ? name.zh : name.en;
}
