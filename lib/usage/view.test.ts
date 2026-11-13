import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SORT,
  formatShare,
  MAX_PAGE,
  neverOpened,
  nextSort,
  pageCount,
  parseDays,
  parsePage,
  parseTask,
  share,
  sortRows,
  taskRows,
  usageHref,
  windowQuery,
} from '@/lib/usage/view';
import type { TaskUsage } from '@/lib/types/usage';

/** View Usages: the day selector, the addresses, and the By Task table's logic (lib/usage/view.ts). */

describe('the day selector', () => {
  it('takes 7, 30 or 90 from the address, and 30 for anything else', () => {
    expect(parseDays({ days: '7' })).toBe(7);
    expect(parseDays({ days: '30' })).toBe(30);
    expect(parseDays({ days: ['90', '7'] })).toBe(90);
    expect(parseDays({})).toBe(30);
    expect(parseDays({ days: '' })).toBe(30);
    expect(parseDays({ days: '14' })).toBe(30);
    expect(parseDays({ days: 'week' })).toBe(30);
  });

  it('reads the page, from 1', () => {
    expect(parsePage({ page: '3' })).toBe(3);
    expect(parsePage({})).toBe(1);
    expect(parsePage({ page: '0' })).toBe(1);
    expect(parsePage({ page: '1.5' })).toBe(1);
    expect(parsePage({ page: 'x' })).toBe(1);
  });

  it('never reads a page beyond the last one a list can be asked for', () => {
    expect(parsePage({ page: String(MAX_PAGE) })).toBe(MAX_PAGE);
    expect(parsePage({ page: '99999999999' })).toBe(MAX_PAGE);
    expect(parsePage({ page: '1e300' })).toBe(MAX_PAGE);
  });

  it('counts the pages of a list; an empty list has its first page', () => {
    expect(pageCount(0, 50)).toBe(1);
    expect(pageCount(50, 50)).toBe(1);
    expect(pageCount(51, 50)).toBe(2);
  });

  it("carries the window from one of the task's views to another, the default left out", () => {
    expect(windowQuery(new URLSearchParams('days=7&task=jobs'))).toBe('?days=7');
    expect(windowQuery(new URLSearchParams('days=90'))).toBe('?days=90');
    expect(windowQuery(new URLSearchParams('days=30'))).toBe('');
    expect(windowQuery(new URLSearchParams('days=14'))).toBe('');
    expect(windowQuery(new URLSearchParams())).toBe('');
  });

  it('reads the task only when the catalog has it', () => {
    expect(parseTask({ task: 'it-incidents' })).toBe('it-incidents');
    expect(parseTask({ task: 'nowhere' })).toBeNull();
    expect(parseTask({})).toBeNull();
  });

  it('builds each address, leaving out the default window and the first page', () => {
    expect(usageHref('overview')).toBe('/tasks/usages/overview');
    expect(usageHref('overview', { days: 30 })).toBe('/tasks/usages/overview');
    expect(usageHref('tasks', { days: 7 })).toBe('/tasks/usages/tasks?days=7');
    expect(usageHref('unused-access', { task: 'jobs', days: 90, page: 2 })).toBe(
      '/tasks/usages/unused-access?task=jobs&days=90&page=2',
    );
    expect(usageHref('unused-access', { task: null, page: 1 })).toBe('/tasks/usages/unused-access');
  });
});

describe('the share of holders who used a task', () => {
  it('is people over holders, capped at 100%, and none when nobody holds it', () => {
    expect(share(7, 14)).toBe(0.5);
    expect(share(0, 3)).toBe(0);
    // Someone who lost the task since still opened it in the window.
    expect(share(5, 4)).toBe(1);
    expect(share(2, 0)).toBeNull();
  });

  it('is shown as a whole percent, or a dash', () => {
    expect(formatShare(0.5)).toBe('50%');
    expect(formatShare(1 / 3)).toBe('33%');
    expect(formatShare(1)).toBe('100%');
    expect(formatShare(0)).toBe('0%');
    expect(formatShare(null)).toBe('—');
  });
});

const usage: TaskUsage[] = [
  { task: 'it-incidents', opens: 4, people: 2, last_opened_at: '2026-11-12T08:15:02.123456Z', holders: 4 },
  { task: 'workers', opens: 9, people: 3, last_opened_at: '2026-11-10T00:00:00.000000Z', holders: 3 },
  { task: 'jobs', opens: 0, people: 0, last_opened_at: '2026-09-01T00:00:00.000000Z', holders: 2 },
  { task: 'usages', opens: 0, people: 0, last_opened_at: null, holders: 0 },
  { task: 'retired-task', opens: 4, people: 1, last_opened_at: null, holders: 1 },
];
const rows = taskRows(usage, 'en');
const codes = (list: typeof rows) => list.map((row) => row.task);

describe('the By Task rows', () => {
  it('carry the catalog name, grouping and address, and the share', () => {
    expect(rows[0]).toMatchObject({
      task: 'it-incidents', name: 'View IT Incidents', grouping: 'Data', address: '/tasks/it-incidents', share: 0.5,
    });
    expect(rows[3]).toMatchObject({ name: 'View Usages', grouping: 'Administration', address: '/tasks/usages/overview', share: null });
    expect(taskRows(usage, 'zh')[3]).toMatchObject({ name: '查看使用情况', grouping: '管理' });
  });

  it('show a task this catalog lacks by its code, with no address', () => {
    expect(rows[4]).toMatchObject({ name: 'retired-task', grouping: '', address: null, share: 1 });
  });

  it('sort by opens, most first, by default; equal rows keep the catalog order', () => {
    expect(DEFAULT_SORT).toEqual({ key: 'opens', direction: 'descending' });
    expect(codes(sortRows(rows, DEFAULT_SORT, 'en'))).toEqual(['workers', 'it-incidents', 'retired-task', 'jobs', 'usages']);
    expect(codes(sortRows(rows, { key: 'opens', direction: 'ascending' }, 'en'))).toEqual([
      'jobs', 'usages', 'it-incidents', 'retired-task', 'workers',
    ]);
    // The rows given are left as they were.
    expect(codes(rows)).toEqual(usage.map((row) => row.task));
  });

  it('sort by name, in the order of the language shown', () => {
    expect(codes(sortRows(rows, { key: 'name', direction: 'ascending' }, 'en'))).toEqual([
      'workers', 'jobs', 'retired-task', 'it-incidents', 'usages',
    ]);
    // Chinese names sort by pinyin for zh, not by code point.
    const zh = taskRows(usage.slice(0, 4), 'zh');
    expect(zh.map((row) => row.name)).toEqual(['查看 IT 事件', '维护员工与组织', '管理作业', '查看使用情况']);
    expect(codes(sortRows(zh, { key: 'name', direction: 'ascending' }, 'zh'))).toEqual(
      [...zh].sort((a, b) => a.name.localeCompare(b.name, 'zh')).map((row) => row.task),
    );
    expect(codes(sortRows(zh, { key: 'name', direction: 'ascending' }, 'zh'))[0]).toBe('it-incidents');
  });

  it('put a missing share or time last, in both directions', () => {
    expect(codes(sortRows(rows, { key: 'share', direction: 'descending' }, 'en'))).toEqual([
      'workers', 'retired-task', 'it-incidents', 'jobs', 'usages',
    ]);
    expect(codes(sortRows(rows, { key: 'share', direction: 'ascending' }, 'en'))).toEqual([
      'jobs', 'it-incidents', 'workers', 'retired-task', 'usages',
    ]);
    expect(codes(sortRows(rows, { key: 'last_opened_at', direction: 'descending' }, 'en'))).toEqual([
      'it-incidents', 'workers', 'jobs', 'usages', 'retired-task',
    ]);
    expect(codes(sortRows(rows, { key: 'last_opened_at', direction: 'ascending' }, 'en'))).toEqual([
      'jobs', 'workers', 'it-incidents', 'usages', 'retired-task',
    ]);
  });

  it('change direction on the same column, and start text A to Z and numbers largest first', () => {
    expect(nextSort(DEFAULT_SORT, 'opens')).toEqual({ key: 'opens', direction: 'ascending' });
    expect(nextSort({ key: 'opens', direction: 'ascending' }, 'opens')).toEqual(DEFAULT_SORT);
    expect(nextSort(DEFAULT_SORT, 'name')).toEqual({ key: 'name', direction: 'ascending' });
    expect(nextSort(DEFAULT_SORT, 'grouping')).toEqual({ key: 'grouping', direction: 'ascending' });
    expect(nextSort(DEFAULT_SORT, 'share')).toEqual({ key: 'share', direction: 'descending' });
  });

  it('filter to the tasks nobody opened in the window', () => {
    expect(codes(neverOpened(rows))).toEqual(['jobs', 'usages']);
  });
});
