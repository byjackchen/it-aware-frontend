/**
 * Server-side clients for View IT CSAT (`csat:responses:read`) and View Raw
 * Records (`raw:<source>:read`, one per source).
 */

import { fetchApi } from '@/lib/api/core';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { isRawSource } from '@/lib/data-tasks/view';
import type { CsatResponses, RawRecords } from '@/lib/types/data-tasks';

const BASE = RUNTIME_CONFIG.backend.domain;

export async function getCsatResponses(limit: number, skip: number, incident: string | null): Promise<CsatResponses> {
  const query = new URLSearchParams({ limit: String(limit), skip: String(skip) });
  if (incident) query.set('incident_number', incident);
  return fetchApi(`${BASE}/csat/responses?${query}`);
}

export async function getRawRecords(source: string, limit: number, cursor: string | null, key: string | null): Promise<RawRecords> {
  // The source is one path segment from the catalog's views, never free text.
  if (!isRawSource(source)) throw new Error(`Not a raw source: ${JSON.stringify(source)}`);
  const query = new URLSearchParams({ limit: String(limit) });
  if (cursor) query.set('cursor', cursor);
  if (key) query.set('key', key);
  return fetchApi(`${BASE}/raw/${source}/records?${query}`);
}
