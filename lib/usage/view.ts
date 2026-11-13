/**
 * View Usages: where its four views and their sub-pages live, how their search
 * parameters are read, the By Task table's rows, share, sorting and filter,
 * and the shaping of who used what.
 *
 *   /tasks/usages/overview[?days=]
 *   /tasks/usages/tasks[?days=]
 *   /tasks/usages/tasks/<task>[?days=][&page=]     the people who opened one task
 *   /tasks/usages/people[?days=][&page=]
 *   /tasks/usages/people/<oid>[?days=]             one person
 *   /tasks/usages/unused-access[?task=<code>][&days=][&page=]
 *
 * A sub-page lies under its view's address (the catalog's rule for a record
 * or sub-page), so it is that view's: its tab is marked and opening it counts
 * as opening the view.
 */

import { TASKS, groupingName, named } from '@/lib/tasks/catalog';
import type { Task } from '@/lib/types/tasks';
import type { PersonTask, TaskUsage } from '@/lib/types/usage';

// ── The window and the addresses ─────────────────────────────────────────────

/** The windows the backend accepts, in UTC days. */
export const WINDOWS = [7, 30, 90] as const;
export type WindowDays = (typeof WINDOWS)[number];
export const DEFAULT_DAYS: WindowDays = 30;

/** Accounts per page of Unused Access. */
export const UNUSED_PAGE_SIZE = 50;

/** People per page of By Person and of the people of a task. */
export const PEOPLE_PAGE_SIZE = 50;

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

export type UsageViewSlug = 'overview' | 'tasks' | 'people' | 'unused-access';

export interface UsageLink {
  days?: number;
  task?: string | null;
  page?: number;
  /** A sub-page of the view: a task's code under By Task, a person's oid under By Person. */
  sub?: string | null;
}

/** The address of a view or one of its sub-pages; the default window and the first page are left out. */
export function usageHref(view: UsageViewSlug, link: UsageLink = {}): string {
  const query = new URLSearchParams();
  if (link.task) query.set('task', link.task);
  if (link.days && link.days !== DEFAULT_DAYS) query.set('days', String(link.days));
  if (link.page && link.page > 1) query.set('page', String(link.page));
  const text = query.toString();
  const sub = link.sub ? `/${encodeURIComponent(link.sub)}` : '';
  return `/tasks/usages/${view}${sub}${text ? `?${text}` : ''}`;
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

// ── Who used what ────────────────────────────────────────────────────────────

/** A task's name in the current language; its code when the catalog no longer has it. */
export function taskName(code: string, locale: string): string {
  const task = TASKS.find((candidate) => candidate.code === code);
  return task ? named(task.name, locale) : code;
}

/** The names of a task's views, in the order given: the catalog's name, or the slug the catalog lacks. */
export function viewNames(code: string, slugs: string[], locale: string): string[] {
  const views = TASKS.find((candidate) => candidate.code === code)?.views ?? [];
  return slugs.map((slug) => {
    const view = views.find((candidate) => candidate.slug === slug);
    return view ? named(view.name, locale) : slug;
  });
}

export interface PersonTaskRow extends PersonTask {
  /** The catalog's name, or the code as recorded. */
  name: string;
  /** Whether the catalog still has the task. */
  known: boolean;
  /** Where the task opens for the viewer; null when they do not hold it, or it is no task now. */
  address: string | null;
  /** The views opened, by name. */
  viewNames: string[];
}

/** One person's tasks, in the order given, named, with the viewer's own address of the tasks they hold. */
export function personTaskRows(tasks: PersonTask[], held: Task[] | null, locale: string): PersonTaskRow[] {
  return tasks.map((usage) => {
    const known = TASKS.some((candidate) => candidate.code === usage.task);
    const mine = held?.find((candidate) => candidate.code === usage.task);
    return {
      ...usage,
      name: taskName(usage.task, locale),
      known,
      address: known && mine ? mine.address : null,
      viewNames: viewNames(usage.task, usage.views, locale),
    };
  });
}

/** A label beside an account: a message key of `Usage.labels`, or the backend's own word for a type it has no message for. */
export type AccountLabel = { key: 'inactive' | 'integration' } | { text: string };

/** What tells an account apart from a real, active user: inactive, and a type other than `user`. */
export function accountLabels(account: { active: boolean; account_type: string }): AccountLabel[] {
  const labels: AccountLabel[] = [];
  if (!account.active) labels.push({ key: 'inactive' });
  if (account.account_type === 'integration') labels.push({ key: 'integration' });
  else if (account.account_type !== 'user') labels.push({ text: account.account_type });
  return labels;
}
