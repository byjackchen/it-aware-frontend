/**
 * Server-side client for View Usages (backend `/usage`, specs/backend/api_specs_usage.md).
 * Every read needs `systems:usage:read`.
 */

import { redirect, unstable_rethrow } from 'next/navigation';
import { fetchApi } from '@/lib/api/core';
import { ApiError } from '@/lib/api/errors';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { isSegment } from '@/lib/usage/view';
import type { PersonUsage, TaskPeople, UnusedAccess, UsageByTask, UsageOverview, UsagePeople } from '@/lib/types/usage';

const BASE = `${RUNTIME_CONFIG.backend.domain}/usage`;

export async function getUsageOverview(days: number): Promise<UsageOverview> {
  return fetchApi(`${BASE}/overview?days=${days}`);
}

export async function getUsageByTask(days: number): Promise<UsageByTask> {
  return fetchApi(`${BASE}/tasks?days=${days}`);
}

export async function getUnusedAccess(task: string, days: number, limit: number, offset: number): Promise<UnusedAccess> {
  const query = new URLSearchParams({ task, days: String(days), limit: String(limit), offset: String(offset) });
  return fetchApi(`${BASE}/unused-access?${query}`);
}

/** A list's window and page, as the paged reads take them. */
function paged(days: number, limit: number, offset: number): URLSearchParams {
  return new URLSearchParams({ days: String(days), limit: String(limit), offset: String(offset) });
}

/**
 * A task code or an oid as one segment of a backend path. Only letters, digits,
 * `_` and `-` pass: a `.` or `..` segment would be collapsed by the URL parser
 * (also when escaped as %2E) and reach another endpoint.
 */
function segment(value: string): string {
  if (!isSegment(value)) throw new Error(`Not a task code or oid: ${JSON.stringify(value)}`);
  return value;
}

/** The people who opened one task in the window. */
export async function getTaskPeople(task: string, days: number, limit: number, offset: number): Promise<TaskPeople> {
  return fetchApi(`${BASE}/tasks/${segment(task)}/people?${paged(days, limit, offset)}`);
}

/** Everyone active in the window. */
export async function getUsagePeople(days: number, limit: number, offset: number): Promise<UsagePeople> {
  return fetchApi(`${BASE}/people?${paged(days, limit, offset)}`);
}

/** One person's sign-ins and the tasks they opened in the window. */
export async function getPersonUsage(oid: string, days: number): Promise<PersonUsage> {
  return fetchApi(`${BASE}/people/${segment(oid)}?days=${days}`);
}

/**
 * Run a read for a page: its data, or the message of the failure to show.
 * A person who is signed out goes to the login page (fetchApi's redirect is
 * thrown on), and one without the permission (403) to the no-access page.
 */
export async function load<T>(read: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    return { ok: true, data: await read() };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403) redirect('/access-denied');
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
