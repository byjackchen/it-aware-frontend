/**
 * Client-side API fetchers for the Ops Dashboard.
 *
 * These call through the Next.js `/api/objects/<resource>` proxy route
 * (which already forwards arbitrary query params to the backend) and
 * always pin `view=slim` so the dashboard gets the lean payload plus
 * the server's 60s `Cache-Control: private, max-age=60` response cache.
 *
 * All three endpoints may return `partial: true` under the server's 5s
 * response-budget timeout; callers get the raw envelope and render the
 * soft "still loading, retry" banner via i18n.
 */

// =============================================================================
// Shared types
// =============================================================================

export interface ListResponse<T> {
    items: T[];
    /** `null` when the server could not compute a total (typically on slim + partial). */
    total: number | null;
    skip: number;
    limit: number;
    /** True if the server's 5s response-budget timeout fired before pagination finished. */
    partial?: boolean;
}

export interface ActorOrganizationRef {
    descriptor: string | null;
}

export interface ActorLocationRef {
    descriptor: string | null;
    /** AMER / EMEA / APAC, or another free-text string the server resolved from the hierarchy. */
    region: 'AMER' | 'EMEA' | 'APAC' | string | null;
}

export interface ActorRef {
    oid: string;
    fullname: string | null;
    organization: ActorOrganizationRef | null;
    location: ActorLocationRef | null;
}

/**
 * Common activity row shape for incidents + requests in the slim view.
 *
 * The optional `item`/`request_item`/`subcategory`/`impact` fields are
 * present only on the corresponding object_type; we keep them all in
 * one shape to avoid forcing pages to discriminate at every touch.
 */
export interface TicketRow {
    oid: string;
    stable_id: string;
    object_type: 'incident' | 'request';
    title: string;
    state: string;
    priority: string;
    urgency: string;
    channel: string | null;
    category: string | null;
    /** Incidents only. */
    subcategory?: string | null;
    /** Incidents only. */
    impact?: string | null;
    /** Incidents only. */
    sn_id?: string | null;
    /** Incidents only. */
    service_catalog_oid?: string | null;
    /** Incidents only. */
    configuration_item_oid?: string | null;
    /** Requests only. */
    item?: string | null;
    /** Requests only. */
    request_item?: string | null;

    actor_oid: string;
    actor_role: string;
    assigned_to_oid: string | null;
    assigned_group: string | null;
    caller_name: string | null;
    assigned_to_name: string | null;

    /** ISO datetime — DB-row create time (Phase 2: server-managed). */
    created_at: string;
    /** ISO datetime — DB-row last mutation (Phase 2: server-managed via onupdate). */
    updated_at: string;
    effective_at: string;

    // ----- Phase 2 — upstream (ServiceNow) authoritative timestamps ---------
    /** SN sys_created_on — upstream create time. Nullable on pre-backfill rows. */
    source_created_at?: string | null;
    /**
     * SN sys_updated_on — the ops-dashboard aging clock. Prefer this for
     * ``daysSinceUpdated``; fall back to ``updated_at`` only when null
     * (non-SN activity source).
     */
    source_updated_at?: string | null;
    source_opened_at?: string | null;
    /** Incidents only — SN resolved timestamp. */
    source_resolved_at?: string | null;
    source_closed_at?: string | null;
    /** Incidents only. */
    source_last_reopened_at?: string | null;
    source_sla_due?: string | null;
    source_due_date?: string | null;
    source_expected_start?: string | null;
    /** Requests only — SN agent_updated. */
    source_agent_updated_at?: string | null;

    // ----- Phase 2 — SLA / escalation ---------------------------------------
    made_sla?: boolean | null;
    /** Incidents only. */
    escalation?: number | null;
    /** Incidents only. */
    severity?: string | null;
    /** Incidents only. */
    reopen_count?: number | null;
    reassignment_count?: number | null;

    // ----- Phase 2 — duration / time-to-resolve (in seconds) ----------------
    /** Total elapsed seconds between create and close, calendar time. */
    duration_sec?: number | null;
    /** Elapsed seconds excluding pause (incidents only). */
    business_duration_w_pause_sec?: number | null;
    /** Business-hours-only elapsed duration (SN business calendar). */
    business_duration_sec?: number | null;
    /** Total seconds between create and resolve (incidents only). */
    resolve_time_sec?: number | null;
    /** Business-hours-only seconds between create and resolve (incidents only). */
    business_resolve_time_sec?: number | null;

    // ----- Phase 2 — ticket-anchored dimensions (vs. actor-derived) ---------
    location?: string | null;
    department?: string | null;
    company?: string | null;

    /** Eager-loaded actor from the ops-dashboard 1.1.4 join. */
    actor: ActorRef | null;
}

export interface HardwareRow {
    oid: string;
    serial_number: string;
    asset_tag: string | null;
    model_category: string | null;
    main_category: string | null;
    model_name: string | null;
    model_display_name: string | null;
    asset_status: string | null;
    substatus: string | null;
    stock_room: string | null;
    region: string | null;
    /** Uppercased region code resolved from the office hierarchy (AMER / EMEA / APAC). */
    office_region: string | null;
    office_id: string | null;
    region_code: string | null;
    department: string | null;
    company: string | null;
    /** Procurement-side ownership (e.g. "OIT", "Studio") — surfaced in the Procured By donut. */
    asset_owner: string | null;
    residual_value: string | number | null;
    cost: string | number | null;
    assigned_to_display_name: string | null;
    assigned_to_username: string | null;
    worker_oid: string | null;
    is_active: boolean;
    assigned_date: string | null;
    /** First-time assignment timestamp — earlier than `assigned_date` when reassigned. */
    first_assigned_date?: string | null;
    /** SN/ERP-side asset creation timestamp — closest proxy to procurement / install date. */
    erp_created_date?: string | null;
    location: string | null;
    created_at: string;
    updated_at: string;
}

// =============================================================================
// Query params
// =============================================================================

/** Base list params common to all three dashboard endpoints. */
export interface BaseListParams {
    skip?: number;
    limit?: number;
    /** Dashboard always sends 'slim'; exposed so callers can override for testing. */
    view?: 'full' | 'slim';
}

/** Activity list filter params (shared by incidents + requests). */
export interface ActivityListParams extends BaseListParams {
    state?: string;
    priority?: string;
    stable_id?: string;
    assigned_group?: string[];
    /**
     * Multi-value state filter. Matches ``state = ANY(states_list)`` on the
     * server. Pass ``ACTIVE_STATES`` from ``lib/ops_dashboard/aggregate`` to
     * narrow a fetch to open tickets only — aligned with the
     * backend's ``states_list`` FilterSpec.
     */
    states_list?: readonly string[];
    /** Joins to caller worker. */
    is_vip?: boolean;
    /** Base64 OID strings — backs the "Location" sidebar slicer. */
    actor_location_oid?: string[];
    /** Base64 OID strings — backs the "Department/Organization" sidebar slicer. */
    actor_org_oid?: string[];
    created_at_from?: string;
    created_at_to?: string;
    updated_at_from?: string;
    updated_at_to?: string;
    effective_at_from?: string;
    effective_at_to?: string;
    // ----- Phase 2 — source_* timestamp + SLA / escalation filters ---------
    source_updated_at_from?: string;
    source_updated_at_to?: string;
    source_opened_at_from?: string;
    source_opened_at_to?: string;
    /** Incidents only. */
    source_resolved_at_from?: string;
    /** Incidents only. */
    source_resolved_at_to?: string;
    /** Requests only. */
    source_closed_at_from?: string;
    /** Requests only. */
    source_closed_at_to?: string;
    made_sla?: boolean;
    /** Incidents only — filter rows with ``COALESCE(escalation, 0) >= N``. */
    escalation_min?: number;
}

export type IncidentListParams = ActivityListParams;
export type RequestListParams = ActivityListParams;

export interface HardwareListParams extends BaseListParams {
    worker_oid?: string;
    assigned_to_username?: string;
    serial_number?: string;
    asset_tag?: string;
    model_category?: string;
    main_category?: string;
    asset_status?: string;
    /** Multi-value — Pending Assets 3-tab uses this. */
    substatus?: string[];
    office_id?: string;
    region?: string;
    is_active?: boolean;
    unassigned?: boolean;
}

// =============================================================================
// URL building
// =============================================================================

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

function buildActivityQuery(params: ActivityListParams): string {
    const q = new URLSearchParams();
    // Dashboard contract: always slim unless explicitly overridden.
    q.set('view', params.view ?? 'slim');
    appendParam(q, 'state', params.state);
    appendParam(q, 'priority', params.priority);
    appendParam(q, 'stable_id', params.stable_id);
    appendParam(q, 'assigned_group', params.assigned_group);
    appendParam(q, 'states_list', params.states_list);
    appendParam(q, 'is_vip', params.is_vip);
    appendParam(q, 'actor_location_oid', params.actor_location_oid);
    appendParam(q, 'actor_org_oid', params.actor_org_oid);
    appendParam(q, 'created_at_from', params.created_at_from);
    appendParam(q, 'created_at_to', params.created_at_to);
    appendParam(q, 'updated_at_from', params.updated_at_from);
    appendParam(q, 'updated_at_to', params.updated_at_to);
    appendParam(q, 'effective_at_from', params.effective_at_from);
    appendParam(q, 'effective_at_to', params.effective_at_to);
    // Phase 2 — source_* timestamp + SLA / escalation filters.
    appendParam(q, 'source_updated_at_from', params.source_updated_at_from);
    appendParam(q, 'source_updated_at_to', params.source_updated_at_to);
    appendParam(q, 'source_opened_at_from', params.source_opened_at_from);
    appendParam(q, 'source_opened_at_to', params.source_opened_at_to);
    appendParam(q, 'source_resolved_at_from', params.source_resolved_at_from);
    appendParam(q, 'source_resolved_at_to', params.source_resolved_at_to);
    appendParam(q, 'source_closed_at_from', params.source_closed_at_from);
    appendParam(q, 'source_closed_at_to', params.source_closed_at_to);
    appendParam(q, 'made_sla', params.made_sla);
    appendParam(q, 'escalation_min', params.escalation_min);
    if (params.skip !== undefined) q.set('skip', String(params.skip));
    if (params.limit !== undefined) q.set('limit', String(params.limit));
    return q.toString();
}

function buildHardwareQuery(params: HardwareListParams): string {
    const q = new URLSearchParams();
    q.set('view', params.view ?? 'slim');
    appendParam(q, 'worker_oid', params.worker_oid);
    appendParam(q, 'assigned_to_username', params.assigned_to_username);
    appendParam(q, 'serial_number', params.serial_number);
    appendParam(q, 'asset_tag', params.asset_tag);
    appendParam(q, 'model_category', params.model_category);
    appendParam(q, 'main_category', params.main_category);
    appendParam(q, 'asset_status', params.asset_status);
    appendParam(q, 'substatus', params.substatus);
    appendParam(q, 'office_id', params.office_id);
    appendParam(q, 'region', params.region);
    appendParam(q, 'is_active', params.is_active);
    appendParam(q, 'unassigned', params.unassigned);
    if (params.skip !== undefined) q.set('skip', String(params.skip));
    if (params.limit !== undefined) q.set('limit', String(params.limit));
    return q.toString();
}

// =============================================================================
// Fetchers
// =============================================================================

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        if (response.status === 401) throw new Error('Not authenticated');
        throw new Error(`Failed to fetch (${response.status})`);
    }
    return response.json() as Promise<T>;
}

/**
 * Build the dashboard URL for a given resource. Uses the existing
 * `/api/objects/<resource>` Next.js proxy which forwards arbitrary
 * query params to the backend.
 */
export function buildOpsDashboardUrl(
    resource: 'incidents' | 'requests' | 'hardwares',
    queryString: string,
): string {
    return `/api/objects/${resource}${queryString ? `?${queryString}` : ''}`;
}

export async function fetchIncidents(
    params: IncidentListParams = {},
): Promise<ListResponse<TicketRow>> {
    const qs = buildActivityQuery(params);
    return fetchJson<ListResponse<TicketRow>>(buildOpsDashboardUrl('incidents', qs));
}

export async function fetchRequests(
    params: RequestListParams = {},
): Promise<ListResponse<TicketRow>> {
    const qs = buildActivityQuery(params);
    return fetchJson<ListResponse<TicketRow>>(buildOpsDashboardUrl('requests', qs));
}

export async function fetchHardwares(
    params: HardwareListParams = {},
): Promise<ListResponse<HardwareRow>> {
    const qs = buildHardwareQuery(params);
    return fetchJson<ListResponse<HardwareRow>>(buildOpsDashboardUrl('hardwares', qs));
}

