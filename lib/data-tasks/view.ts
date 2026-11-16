/**
 * What View IT CSAT and View Raw Records' pages share: their page sizes, the
 * search parameters they keep in the address, the raw source of a view, and a
 * value shown in a table cell.
 */

import { TASKS } from '@/lib/tasks/catalog';

export const CSAT_PAGE_SIZE = 100;
export const RAW_PAGE_SIZE = 100;

/** The raw sources View Raw Records has a view for, by the view's slug. */
export const RAW_SOURCES: ReadonlyMap<string, string> = new Map(
  TASKS.filter((task) => task.code === 'raw-records')
    .flatMap((task) => task.views)
    .map((view) => [view.slug, view.slug.replaceAll('-', '_')]),
);

/** The source of the view `slug`; null for a slug that is no view of the task. */
export function rawSourceOf(slug: string): string | null {
  return RAW_SOURCES.get(slug) ?? null;
}

export function isRawSource(source: string): boolean {
  return [...RAW_SOURCES.values()].includes(source);
}

/** One search parameter as text: the first value, trimmed; null when empty. */
export function param(value: string | string[] | undefined): string | null {
  const first = (Array.isArray(value) ? value[0] : value)?.trim();
  return first ? first : null;
}

/** A 1-based page number; 1 for anything else. */
export function parsePage(value: string | string[] | undefined): number {
  const page = Number(param(value));
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** An address with the given search parameters, the empty ones left out. */
export function withQuery(path: string, params: Record<string, string | number | null>): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== '') query.set(name, String(value));
  }
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

/** A field's value as cell text: text and numbers as they are, anything else as compact JSON, nothing as —. */
export function cell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
