/**
 * Typed wrapper for the Ops Dashboard Hub report endpoint.
 *
 * Backed by `GET /objects/activities/ops-dashboard/report/hub` on the
 * backend (see `specs/backend/ops_dashboard_predicates.md`). Returns
 * precomputed KPIs + chart series + filter_options so the Active
 * Monitoring Hub page renders without doing any aggregation in the
 * browser.
 *
 * Calls go through the Next.js proxy at
 * `app/api/ops-dashboard/report/hub/route.ts` which forwards query
 * params and injects the `it_aware_access` cookie server-side. (The
 * default `/api/objects/[resource]` proxy can't accept multi-segment
 * paths — same reason the Ohla Chatbot pattern got its own proxy.)
 */

// ── Response shapes — kept structurally identical to the Pydantic
//    schemas in `app/objects/activities/ops_dashboard/schemas.py`. ─────────

export interface NameValueRow {
    name: string;
    value: number;
}

export interface KeyCountRow {
    key: string;
    count: number;
}

export type HubRegion = 'AMER' | 'EMEA' | 'APAC' | 'OTHER';

export interface RegionCountRow {
    region: HubRegion;
    count: number;
}

export interface HubKpis {
    totalActive: number;
    activeIncident: number;
    activeIncidentHigh: number;
    activeCatalog: number;
    activeAsset: number;
    vipActive: number;
    unassigned: number;
    agingIncidentGt2d: number;
    agingCatalogGt30d: number;
    agingAssetGt30d: number;
}

/**
 * Subset of KPIs available on the previous-window snapshot — only the four
 * `…Active` KPIs that drive MoM tiles. VIP MoM is intentionally absent
 * (spec §8: the current backend doesn't yet replay VIP membership history;
 * adding it later is a non-breaking schema extension).
 */
export interface HubPreviousKpis {
    totalActive: number;
    activeIncident: number;
    activeCatalog: number;
    activeAsset: number;
}

export interface HubCharts {
    group_donut: NameValueRow[];
    /** Top-10 by active ticket count; unassigned rows bucket as `"Unassigned"`. */
    assignee_bar: KeyCountRow[];
    /** Always 4 entries — AMER/EMEA/APAC/OTHER — even when count=0. */
    region: RegionCountRow[];
}

export interface HubFilterOptions {
    assigned_groups: string[];
    locations: string[];
    priorities: string[];
}

export interface HubCurrentBlock {
    kpis: HubKpis;
    charts: HubCharts;
    filter_options: HubFilterOptions;
}

export interface HubPreviousBlock {
    kpis: HubPreviousKpis;
}

export interface HubMeta {
    /** ISO 8601 — server clock the aggregate used for §5 aging + §8 MoM math. */
    now: string;
    /** ISO 8601 — equal to `now` unless the response was served from cache. */
    snapshot_at: string;
    /** True when the underlying query hit the 5s statement-timeout budget. */
    partial?: boolean;
}

export interface OpsHubReport {
    current: HubCurrentBlock;
    previous: HubPreviousBlock;
    meta: HubMeta;
}

// ── Query params ─────────────────────────────────────────────────────────

export interface OpsHubReportParams {
    /** ISO datetimes — frontend produces them via snDayStartIso/snDayEndIso. */
    source_created_at_from?: string;
    source_created_at_to?: string;
    /** Subset of AMER/EMEA/APAC/OTHER. */
    region_in?: string[];
    /** Canonical country labels (see spec §7.2). */
    country_in?: string[];
    /** Verbatim actor.location.descriptor values. */
    location_in?: string[];
    /** Donut-driven assigned_group values. */
    assigned_group_in?: string[];
    /** Verbatim priority strings. */
    priority_in?: string[];
}

// ── Fetcher ──────────────────────────────────────────────────────────────

function appendParam(query: URLSearchParams, key: string, value: unknown): void {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
        for (const v of value) {
            if (v === undefined || v === null) continue;
            const normalized = String(v).trim();
            if (normalized.length === 0) continue;
            query.append(key, normalized);
        }
        return;
    }
    if (typeof value === 'string') {
        const normalized = value.trim();
        if (normalized.length === 0) return;
        query.set(key, normalized);
        return;
    }
    query.set(key, String(value));
}

function buildQuery(params: OpsHubReportParams): string {
    const q = new URLSearchParams();
    appendParam(q, 'source_created_at_from', params.source_created_at_from);
    appendParam(q, 'source_created_at_to', params.source_created_at_to);
    appendParam(q, 'region_in', params.region_in);
    appendParam(q, 'country_in', params.country_in);
    appendParam(q, 'location_in', params.location_in);
    appendParam(q, 'assigned_group_in', params.assigned_group_in);
    appendParam(q, 'priority_in', params.priority_in);
    return q.toString();
}

export async function fetchOpsHubReport(
    params: OpsHubReportParams = {},
): Promise<OpsHubReport> {
    const qs = buildQuery(params);
    const url = `/api/ops-dashboard/report/hub${qs ? `?${qs}` : ''}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
        if (resp.status === 401) throw new Error('Not authenticated');
        const body = await resp.text().catch(() => '');
        throw new Error(
            `ops-dashboard/report/hub fetch failed: ${resp.status} ${body.slice(0, 200)}`,
        );
    }
    return (await resp.json()) as OpsHubReport;
}
