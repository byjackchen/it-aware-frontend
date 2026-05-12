"use client";

import type { Interaction, Incident, ReviewCode } from '@/lib/types/objects';

// ============================================================================
// Review APIs (client-side — calls Next.js proxy, which forwards auth cookies)
// ============================================================================

export interface InteractionReviewPayload {
    review_ci?: string | null;
    review_code?: ReviewCode | null;
    review_needs_optimization?: boolean | null;
    review_optimization_notes?: string | null;
    mark_completed?: boolean | null;
}

export async function updateInteractionReview(
    oid: string,
    payload: InteractionReviewPayload,
): Promise<Interaction> {
    const res = await fetch(`/api/objects/interactions/${oid}/review`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const detail = await res.text();
        throw new Error(`PATCH /interactions/${oid}/review failed: ${res.status} ${detail}`);
    }
    return res.json();
}

export interface IncidentReviewPayload {
    review_summary?: string | null;
    review_needs_optimization?: boolean | null;
    review_optimization_notes?: string | null;
    csat_score?: number | null;
    csat_text?: string | null;
    pre_ticket_interaction_oids?: string[] | null;
    related_kb_article_oids?: string[] | null;
    mark_completed?: boolean | null;
}

export async function updateIncidentReview(
    oid: string,
    payload: IncidentReviewPayload,
): Promise<Incident> {
    const res = await fetch(`/api/objects/incidents/${oid}/review`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const detail = await res.text();
        throw new Error(`PATCH /incidents/${oid}/review failed: ${res.status} ${detail}`);
    }
    return res.json();
}

// ============================================================================
// Excel export helper
// ============================================================================

export interface ExportFilters {
  created_at_from?: string;
  created_at_to?: string;
  // SSC dashboard 2026-05-11 — SN-business-time bounds for the incidents
  // export. Interactions export still uses created_at_from/to because
  // activities.interactions has no source_created_at column.
  source_created_at_from?: string;
  source_created_at_to?: string;
  actor_stable_id?: string;
  needs_optimization?: boolean;
  completed?: boolean;
}

/**
 * Fetch the xlsx from the proxy and trigger a browser download.
 *
 * Works for both `interactions` and `incidents` exports because both proxies
 * accept the same filter parameter shape and return the same xlsx + Content-Disposition.
 *
 * Throws on non-2xx with a user-friendly message extracted from the response body.
 */
export async function downloadDashboardXlsx(
  resource: 'interactions' | 'incidents',
  filters: ExportFilters,
  fallbackName: string,
): Promise<void> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') {
      params.set(k, String(v));
    }
  }

  const res = await fetch(`/api/objects/${resource}/export.xlsx?${params}`);

  if (res.status === 413) {
    let detail: string | undefined;
    try {
      const body = await res.json();
      detail = typeof body?.detail === 'string' ? body.detail : undefined;
    } catch {
      /* ignore */
    }
    throw new Error(detail ?? 'Too many rows — narrow your filter');
  }

  if (!res.ok) {
    let msg = `Download failed: HTTP ${res.status}`;
    try {
      const body = await res.text();
      if (body) msg += `\n${body.slice(0, 200)}`;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  // Try to extract filename from Content-Disposition; fall back to provided name
  const cd = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(cd) ?? /filename=([^;]+)/.exec(cd);
  a.download = match?.[1]?.trim() ?? fallbackName;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
