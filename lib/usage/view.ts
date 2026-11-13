/**
 * View Usages: where its three views live, how their search parameters are
 * read, and the By Task table's rows, share, sorting and filter.
 *
 *   /tasks/usages/overview[?days=]
 *   /tasks/usages/tasks[?days=]
 *   /tasks/usages/unused-access[?task=<code>][&days=][&page=]
 */

import { TASKS, groupingName, named } from '@/lib/tasks/catalog';
import type { TaskUsage } from '@/lib/types/usage';

// ── The window and the addresses ─────────────────────────────────────────────

/** The windows the backend accepts, in UTC days. */
export const WINDOWS = [7, 30, 90] as const;
export type WindowDays = (typeof WINDOWS)[number];
export const DEFAULT_DAYS: WindowDays = 30;

/** Accounts per page of Unused Access. */
export const UNUSED_PAGE_SIZE = 50;

export type UsageParams = Record<string, string | string[] | undefined>;

function one(params: UsageParams, name: string): string | null {
  const value = params[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : null;
}

/** The window the address asks for; the default for none or one the backend would refuse. */
export function parseDays(params: UsageParams): WindowDays {
  const asked = Number(one(params, 'days'));
  return WINDOWS.find((days) => days === asked) ?? DEFAULT_DAYS;
}

/** No list is asked for beyond this page, whatever the address says. */
export const MAX_PAGE = 10_000;

/** The page the address asks for, from 1 to MAX_PAGE. */
export function parsePage(params: UsageParams): number {
  const page = Number(one(params, 'page'));
  return Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1;
}

/** How many pages `total` rows make; an empty list still has its first page. */
export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}

/** The window as the address carries it from one of the task's views to another: `?days=7`, or nothing for the default. */
export function windowQuery(params: { get(name: string): string | null }): string {
  const days = parseDays({ days: params.get('days') ?? undefined });
  return days === DEFAULT_DAYS ? '' : `?days=${days}`;
}

/** The task the address asks for; null for none, or a code that is no task of the catalog. */
export function parseTask(params: UsageParams): string | null {
  const code = one(params, 'task');
  return TASKS.some((task) => task.code === code) ? code : null;
}

export type UsageViewSlug = 'overview' | 'tasks' | 'unused-access';

/** The address of a view; the default window and the first page are left out. */
export function usageHref(view: UsageViewSlug, link: { days?: number; task?: string | null; page?: number } = {}): string {
  const query = new URLSearchParams();
  if (link.task) query.set('task', link.task);
  if (link.days && link.days !== DEFAULT_DAYS) query.set('days', String(link.days));
  if (link.page && link.page > 1) query.set('page', String(link.page));
  const text = query.toString();
  return `/tasks/usages/${view}${text ? `?${text}` : ''}`;
}

// ── By Task ──────────────────────────────────────────────────────────────────

/**
 * The share of a task's holders who opened it in the window, from 0 to 1.
 * People who lost the task since still count as people, so it is capped at 1;
 * null when nobody holds the task.
 */
export function share(people: number, holders: number): number | null {
  return holders > 0 ? Math.min(1, people / holders) : null;
}

/** A share as a whole percent; a dash when there is none. */
export function formatShare(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

export interface TaskRow extends TaskUsage {
  /** The catalog's name and grouping, in the current language; the code itself for a task this catalog lacks. */
  name: string;
  grouping: string;
  /** Where the task opens; null for a task this catalog lacks. */
  address: string | null;
  share: number | null;
}

/** The backend's tasks with their catalog names, in the order given (the catalog's). */
export function taskRows(tasks: TaskUsage[], locale: string): TaskRow[] {
  return tasks.map((usage) => {
    const task = TASKS.find((candidate) => candidate.code === usage.task);
    return {
      ...usage,
      name: task ? named(task.name, locale) : usage.task,
      grouping: task ? groupingName(task.grouping, locale) : '',
      address: task ? task.address : null,
      share: share(usage.people, usage.holders),
    };
  });
}

export type SortKey = 'name' | 'grouping' | 'opens' | 'people' | 'holders' | 'share' | 'last_opened_at';
export interface Sort {
  key: SortKey;
  direction: 'ascending' | 'descending';
}

export const DEFAULT_SORT: Sort = { key: 'opens', direction: 'descending' };
const TEXT_KEYS: SortKey[] = ['name', 'grouping'];

/** The sort after a click on a column: the other direction on the same column; else text A to Z, numbers and times largest first. */
export function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) {
    return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
  }
  return { key, direction: TEXT_KEYS.includes(key) ? 'ascending' : 'descending' };
}

/**
 * The rows sorted, text in the order of the language shown. A missing share or
 * time comes last in both directions; equal rows keep the order given (the
 * catalog's).
 */
export function sortRows(rows: TaskRow[], sort: Sort, locale: string): TaskRow[] {
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[sort.key];
    const y = b[sort.key];
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return sign * (typeof x === 'string' ? x.localeCompare(String(y), locale) : x - Number(y));
  });
}

/** The tasks nobody opened in the window. */
export function neverOpened(rows: TaskRow[]): TaskRow[] {
  return rows.filter((row) => row.opens === 0);
}
