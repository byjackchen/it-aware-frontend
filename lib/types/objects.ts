/**
 * Type definitions for Objects module (organizations, locations, workers, service catalogs, articles).
 * Also includes edges, activities, and registry types for Edge Relationships.
 */

// ============================================================================
// Hierarchy Types (shared base for Organizations and Locations)
// ============================================================================

export interface Hierarchy {
    oid: string;
    object_type: 'organization' | 'location' | 'service_catalog';
    parent_oid: string | null;
    path: string[];
    created_at: string;
    updated_at: string;
}

// ============================================================================
// Organization Types
// ============================================================================

export type OrganizationType =
    | "Top Level"
    | "Business Group"
    | "Line"
    | "Department"
    | "Center"
    | "Team";

export interface Organization {
    oid: string;
    name: string;
    type: OrganizationType;
    stable_id: string | null;
    parent_oid: string | null;
    path: string[];
    is_active: boolean;
    metadata: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

export interface OrganizationCreate {
    name: string;
    type: OrganizationType;
    stable_id?: string | null;
    parent_oid?: string | null;
    is_active?: boolean;
    metadata?: Record<string, unknown> | null;
}

export interface OrganizationUpdate {
    name?: string;
    type?: OrganizationType;
    stable_id?: string | null;
    parent_oid?: string | null;
    is_active?: boolean;
    metadata?: Record<string, unknown> | null;
}

// ============================================================================
// Location Types
// ============================================================================

export type LocationType = "root" | "region" | "country" | "office_location" | "remote_location";

export function getLocationTypeLabel(type: LocationType | string): string {
    switch (type) {
        case 'root':
            return 'Root hierarchy node';
        case 'region':
            return 'Geographic region';
        case 'country':
            return 'Country';
        case 'office_location':
            return 'Physical office';
        case 'remote_location':
            return 'Remote work location';
        default:
            return 'Invalid value';
    }
}

export interface Location {
    oid: string;
    name: string;
    type: LocationType;
    timezone: string; // IANA timezone ID or empty string for non-timezone-sensitive locations
    stable_id: string | null;
    parent_oid: string | null;
    path: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface LocationCreate {
    name: string;
    type: LocationType;
    timezone: string;
    stable_id?: string | null;
    parent_oid?: string | null;
    is_active?: boolean;
}

export interface LocationUpdate {
    name?: string;
    type?: LocationType;
    timezone?: string;
    stable_id?: string | null;
    parent_oid?: string | null;
    is_active?: boolean;
}

// ============================================================================
// Service Catalog Types
// ============================================================================

export interface ServiceCatalog {
    oid: string;
    name: string;
    stable_id: string | null;
    parent_oid: string | null;
    path: string[];
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface ServiceCatalogCreate {
    name: string;
    stable_id?: string | null;
    parent_oid?: string | null;
    is_active?: boolean;
}

export interface ServiceCatalogUpdate {
    name?: string;
    stable_id?: string | null;
    parent_oid?: string | null;
    is_active?: boolean;
}

// ============================================================================
// Worker Types
// ============================================================================

export interface Worker {
    oid: string;
    worker_id: string | null;
    stable_id: string;
    fullname: string;
    email: string | null;
    gender: string | null;
    worker_type: string | null;
    // Job fields (parsed from position_title)
    job_category: string | null;
    job_subcategory: string | null;
    job_professional_level: string | null;
    job_management_level: string | null;
    job_band: string | null;
    job_title: string | null;
    org_oid: string;
    location_oid: string | null;
    manager_oid: string | null;
    hire_date: string | null;
    is_vip: boolean;
    vip_type: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;

    // SSC dashboard — denormalized hierarchy context (populated by Worker list endpoint)
    region_name?: string | null;
    country_name?: string | null;
    department_name?: string | null;
}

export interface WorkerProfileTopicItem {
    topic: string;
    need: string;
    status: 'resolved' | 'unresolved';
    notes: string | null;
}

export interface WorkerProfile {
    worker_oid: string;
    summary: string | null;
    summary_updated_at: string | null;
    topics: WorkerProfileTopicItem[] | null;
    topics_updated_at: string | null;
    tags: string[] | null;
    tags_updated_at: string | null;
}

export interface WorkerProfileUpsert {
    summary?: string | null;
    topics?: WorkerProfileTopicItem[] | null;
    tags?: string[] | null;
}

// ============================================================================
// Hardware Types (standalone — synced from ERP BPMS)
// ============================================================================

export interface Hardware {
    oid: string;
    serial_number: string;
    worker_oid: string | null;

    // Identity
    asset_tag: string | null;
    asset_number: string | null;

    // Model
    model_category: string | null;
    model_display_name: string | null;
    model_name: string | null;
    main_category: string | null;
    asset_function: string | null;
    asset_owner: string | null;

    // Assignment
    assigned_to_username: string | null;
    assigned_to_display_name: string | null;
    employment_type: string | null;
    employment_start_date: string | null;
    assigned_date: string | null;
    first_assigned_date: string | null;

    // Location / Org
    company: string | null;
    business_group: string | null;
    department: string | null;
    location: string | null;
    office_id: string | null;
    region_code: string | null;
    region: string | null;
    office_region: string | null;
    stock_room: string | null;

    // Cost (Decimal as string)
    cost: string | null;
    cost_center: string | null;
    procured_cost_center: string | null;
    residual_value: string | null;
    residual_date: string | null;
    budget_by_oit: boolean | null;
    cost_by_oit: boolean | null;

    // Status
    asset_status: string | null;
    substatus: string | null;
    retired_date: string | null;
    scheduled_retirement: string | null;

    // Verification
    verification_status: string | null;
    verified_date: string | null;
    verified_by: string | null;

    // Provenance
    erp_created_by: string | null;
    erp_created_date: string | null;
    erp_updated_date: string | null;
    owned_by: string | null;

    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface HardwareCreate {
    serial_number: string;
    worker_oid?: string | null;
    asset_tag?: string | null;
    asset_number?: string | null;
    model_category?: string | null;
    model_display_name?: string | null;
    model_name?: string | null;
    main_category?: string | null;
    asset_function?: string | null;
    asset_owner?: string | null;
    assigned_to_username?: string | null;
    assigned_to_display_name?: string | null;
    employment_type?: string | null;
    employment_start_date?: string | null;
    assigned_date?: string | null;
    first_assigned_date?: string | null;
    company?: string | null;
    business_group?: string | null;
    department?: string | null;
    location?: string | null;
    office_id?: string | null;
    region_code?: string | null;
    region?: string | null;
    office_region?: string | null;
    stock_room?: string | null;
    cost?: string | null;
    cost_center?: string | null;
    procured_cost_center?: string | null;
    residual_value?: string | null;
    residual_date?: string | null;
    budget_by_oit?: boolean | null;
    cost_by_oit?: boolean | null;
    asset_status?: string | null;
    substatus?: string | null;
    retired_date?: string | null;
    scheduled_retirement?: string | null;
    verification_status?: string | null;
    verified_date?: string | null;
    verified_by?: string | null;
    erp_created_by?: string | null;
    erp_created_date?: string | null;
    erp_updated_date?: string | null;
    owned_by?: string | null;
    is_active?: boolean;
}

export interface HardwareUpdate {
    worker_oid?: string | null;
    asset_tag?: string | null;
    asset_number?: string | null;
    model_category?: string | null;
    model_display_name?: string | null;
    model_name?: string | null;
    main_category?: string | null;
    asset_function?: string | null;
    asset_owner?: string | null;
    assigned_to_username?: string | null;
    assigned_to_display_name?: string | null;
    employment_type?: string | null;
    employment_start_date?: string | null;
    assigned_date?: string | null;
    first_assigned_date?: string | null;
    company?: string | null;
    business_group?: string | null;
    department?: string | null;
    location?: string | null;
    office_id?: string | null;
    region_code?: string | null;
    region?: string | null;
    office_region?: string | null;
    stock_room?: string | null;
    cost?: string | null;
    cost_center?: string | null;
    procured_cost_center?: string | null;
    residual_value?: string | null;
    residual_date?: string | null;
    budget_by_oit?: boolean | null;
    cost_by_oit?: boolean | null;
    asset_status?: string | null;
    substatus?: string | null;
    retired_date?: string | null;
    scheduled_retirement?: string | null;
    verification_status?: string | null;
    verified_date?: string | null;
    verified_by?: string | null;
    erp_created_by?: string | null;
    erp_created_date?: string | null;
    erp_updated_date?: string | null;
    owned_by?: string | null;
    is_active?: boolean;
}

export interface HardwareListResponse {
    items: Hardware[];
    total: number;
    skip: number;
    limit: number;
}

export interface HardwareListParams {
    skip?: number;
    limit?: number;
    worker_oid?: string;
    assigned_to_username?: string;
    serial_number?: string;
    asset_tag?: string;
    model_category?: string;
    main_category?: string;
    asset_status?: string;
    office_id?: string;
    region?: string;
    is_active?: boolean;
    unassigned?: boolean;
}

export interface WorkerCreate {
    worker_id?: string | null;
    stable_id: string;
    fullname: string;
    email?: string | null;
    gender?: string | null;
    worker_type?: string | null;
    // Job fields (parsed from position_title)
    job_category?: string | null;
    job_subcategory?: string | null;
    job_professional_level?: string | null;
    job_management_level?: string | null;
    job_band?: string | null;
    job_title?: string | null;
    org_oid: string;
    location_oid?: string | null;
    manager_oid?: string | null;
    hire_date?: string | null;
    is_vip?: boolean;
    vip_type?: string | null;
    is_active?: boolean;
}

export interface WorkerUpdate {
    worker_id?: string | null;
    stable_id?: string;
    fullname?: string;
    email?: string | null;
    gender?: string | null;
    worker_type?: string | null;
    // Job fields (parsed from position_title)
    job_category?: string | null;
    job_subcategory?: string | null;
    job_professional_level?: string | null;
    job_management_level?: string | null;
    job_band?: string | null;
    job_title?: string | null;
    org_oid?: string;
    location_oid?: string | null;
    manager_oid?: string | null;
    hire_date?: string | null;
    is_vip?: boolean;
    vip_type?: string | null;
    is_active?: boolean;
}

// ============================================================================
// Worker Name Helpers
// ============================================================================

/**
 * Get the full name of a worker.
 */
export function getWorkerFullName(worker: Worker): string {
    return worker.fullname;
}

// ============================================================================
// Worker-Hierarchy-Role Types
// ============================================================================

export interface WorkerHierarchyRole {
    worker_oid: string;
    role_oid: string;
    hierarchy_oid: string;
    assigned_at: string;
}

export interface WorkerHierarchyRoleCreate {
    worker_oid: string;
    role_oid: string;
    hierarchy_oid: string;
}

// ============================================================================
// Registry Types
// ============================================================================

export interface RegistryEntry {
    oid: string;
    object_type: string;
    descriptor: string;
    created_at: string;
    updated_at: string;
}

// ============================================================================
// Edge Types
// ============================================================================

export interface GlobalEdge {
    from_oid: string;
    to_oid: string;
    edge_type: string;
    edge_fact: string | null;
    is_active: boolean;
    effective_at: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
    created_by: string | null;
    from_object?: RegistryEntry | null;
    to_object?: RegistryEntry | null;
}

export interface GlobalEdgeCreate {
    from_oid: string;
    to_oid: string;
    edge_type: string;
    edge_fact?: string | null;
    is_active?: boolean;
    metadata?: Record<string, unknown> | null;
}

export interface GlobalEdgeListResponse {
    items: GlobalEdge[];
    total: number;
    page: number;
    page_size: number;
}

// ============================================================================
// Predefined Edge Types
// ============================================================================

export const EDGE_TYPES = [
    'assigned_to',
    'escalated_to',
    'owned_by',
    'created_by',
    'belongs_to',
    'located_at',
    'reports_to',
    'related_to',
    'depends_on',
    'blocked_by',
    'duplicates',
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

// ============================================================================
// Tree Node Type (for HierarchyTree component)
// ============================================================================

export interface HierarchyTreeNode {
    oid: string;
    name: string;
    children: HierarchyTreeNode[];
    is_active: boolean;
}

// ============================================================================
// Article Types
// ============================================================================

export interface ArticleVersion {
    version_number: number;
    title: string;
    summary: string | null;
    markdown: string;
    source_system: string | null;
    source_url: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export interface Article {
    oid: string;
    stable_id: string | null;
    service_catalog_id: string;
    effective_version_number: number;
    is_active: boolean;
    embedding_ids: string[] | null;
    embedded_at: string | null;
    created_at: string;
    updated_at: string;
    latest_version: ArticleVersion;
}

export interface ArticleCreate {
    service_catalog_id: string;
    stable_id?: string | null;
    title: string;
    summary?: string | null;
    markdown: string;
    source_system?: string | null;
    source_url?: string | null;
    metadata?: Record<string, unknown> | null;
    is_active?: boolean;
}

export interface ArticleUpdate {
    title: string;
    summary?: string | null;
    markdown: string;
    source_system?: string | null;
    source_url?: string | null;
    metadata?: Record<string, unknown> | null;
    is_active?: boolean;
    embedding_ids?: string[] | null;
    embedded_at?: string | null;
}

// ============================================================================
// SSC Dashboard — Review Codes
// ============================================================================

export const REVIEW_CODES = ['ACCT', 'IMP', 'ERR', 'NEW', 'QNC', 'CUST', 'OOS'] as const;
export type ReviewCode = typeof REVIEW_CODES[number];

export const REVIEW_CODE_LABELS: Record<ReviewCode, { en: string; zh: string }> = {
    ACCT: { en: 'Accurate', zh: '内容清晰准确' },
    IMP:  { en: 'Improve',  zh: '需优化改进' },
    ERR:  { en: 'Error',    zh: '错误需修正' },
    NEW:  { en: 'New',      zh: '新增问题' },
    QNC:  { en: 'Unclear',  zh: '问题不清' },
    CUST: { en: 'Custom',   zh: '客制化问题' },
    OOS:  { en: 'OOS',      zh: '不在支援范围内' },
};

// ============================================================================
// Incident AI Category Codes (escalation reason classification)
// ============================================================================

export const INCIDENT_CATEGORIES = ['KB_GAP', 'USER_HABIT', 'AGENT_ERR', 'MANUAL_SSC', 'ONSITE', 'SECURITY', 'MONITORING', 'OUT_OF_SCOPE'] as const;
export type IncidentCategory = typeof INCIDENT_CATEGORIES[number];

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, { en: string; zh: string }> = {
    KB_GAP:       { en: 'KB Gap',       zh: 'KB缺失' },
    USER_HABIT:   { en: 'User Habit',   zh: '用户习惯' },
    AGENT_ERR:    { en: 'Agent Error',  zh: 'Agent错误' },
    MANUAL_SSC:   { en: 'Manual SSC',   zh: '需人工处理' },
    ONSITE:       { en: 'Onsite',       zh: '升级Onsite' },
    SECURITY:     { en: 'Security',     zh: '升级安全' },
    MONITORING:   { en: 'Monitoring',   zh: '系统监控' },
    OUT_OF_SCOPE: { en: 'Out of Scope', zh: '非OIT范围' },
};

export function getIncidentCategoryLabel(cat: IncidentCategory | string, locale: string): string {
    const entry = INCIDENT_CATEGORY_LABELS[cat as IncidentCategory];
    if (!entry) return cat;
    return locale.startsWith('zh') ? entry.zh : entry.en;
}

// ============================================================================
// Activity Types (Incidents, Requests, Interactions)
// ============================================================================

// QA Scoring types
export interface QAScoreItem {
    score: number;
    reason: string;
}

export interface QACategoryScore {
    score: number;
    max: number;
    [key: string]: number | QAScoreItem;
}

export interface QAScoreDetail {
    total_score: number;
    ticket_management: QACategoryScore;
    policies_procedures: QACategoryScore;
    problem_determination: QACategoryScore;
    soft_skills: QACategoryScore;
}

// Phase 3 typed actor: an incident/request actor is one of these four
// kinds. 'worker' is the historical default; 'system' / 'agent' point
// at objects.systems / objects.agents respectively; 'external' has no
// oid (only actor_stable_id).
export type ActorType = 'worker' | 'system' | 'agent' | 'external';

export interface Incident {
    oid: string;
    stable_id: string | null;
    object_type: 'incident';
    title: string;
    description: string | null;
    state: string;
    priority: string | null;
    urgency: string | null;
    category: string | null;
    subcategory: string | null;
    impact: string | null;
    caller_name: string | null;
    assigned_to_name: string | null;
    sn_id: string | null;
    channel: string | null;

    // Relationships
    // Phase 3 typed actor: actor_oid is nullable (external actors have none).
    actor_oid: string | null;
    actor_type: ActorType;
    actor_stable_id: string | null;
    actor_role: string;
    fact: string | null;
    source_system: string | null;
    fact_embedding_id: string | null;
    fact_embedded_at: string | null;
    assigned_to_oid: string | null;
    service_catalog_oid: string | null;
    service_catalog_override_oid: string | null;
    service_type_oid: string | null;
    service_type_override_oid: string | null;
    configuration_item_oid: string | null;
    assigned_group: string | null;
    chat_transcripts: Record<string, unknown> | null;

    created_at: string;
    updated_at: string;
    effective_at: string;

    // SSC dashboard — human review
    review_summary?: string | null;
    review_needs_optimization?: boolean | null;
    review_optimization_notes?: string | null;
    review_completed_at?: string | null;
    review_completed_by_oid?: string | null;

    // SSC dashboard — multi-link arrays
    // NULL = "DAG hasn't computed yet"
    // []   = "DAG computed, no relevant matches"
    // [oid, ...] = "DAG computed with results"
    // The Pre-FAQ button must distinguish null/[] from non-empty for the disabled state.
    pre_ticket_interaction_oids?: string[] | null;
    related_kb_article_oids?: string[] | null;

    // SSC dashboard — CSAT
    csat_score?: number | null;
    csat_text?: string | null;

    // AI classification — escalation reason
    ai_category?: string | null;
    ai_category_reason?: string | null;
    ai_category_at?: string | null;
    // Human review override of ai_category
    review_category?: string | null;

    // QA Scoring — populated by score_incidents_qa DAG
    qa_score?: number | null;
    qa_score_detail?: QAScoreDetail | null;
    qa_scored_at?: string | null;

    // ---------------------------------------------------------------------
    // Phase 2 — ServiceNow authoritative fields.
    // All nullable; historical rows hold NULLs until the one-off backfill
    // or a fresh sync cycle populates them. The ops-dashboard aging clock
    // lives on source_updated_at; base.updated_at is now DB-row lifecycle.
    // See backend docs/activities/timestamp_semantics.md.
    // ---------------------------------------------------------------------
    source_created_at?: string | null;
    source_updated_at?: string | null;
    source_opened_at?: string | null;
    source_resolved_at?: string | null;
    source_closed_at?: string | null;
    source_last_reopened_at?: string | null;
    source_sla_due?: string | null;
    source_due_date?: string | null;
    source_expected_start?: string | null;

    opened_by_name?: string | null;
    resolved_by_name?: string | null;
    closed_by_name?: string | null;
    last_reopened_by_name?: string | null;

    // Ticket-anchored (distinct from actor-anchored).
    location?: string | null;
    department?: string | null;
    company?: string | null;

    service?: string | null;
    service_offering?: string | null;
    configuration_item_display?: string | null;

    made_sla?: boolean | null;
    escalation?: number | null;
    severity?: string | null;
    reopen_count?: number | null;
    reassignment_count?: number | null;

    business_duration_sec?: number | null;
    business_resolve_time_sec?: number | null;
    business_duration_w_pause_sec?: number | null;
    duration_sec?: number | null;
    resolve_time_sec?: number | null;

    on_hold_reason?: string | null;
    resolution_code?: string | null;
    resolution_notes?: string | null;

    correlation_id?: string | null;
    correlation_display?: string | null;

    parent_incident_sn_id?: string | null;
    parent_sn_id?: string | null;
    child_incidents_sn_ids?: string[] | null;
    change_request_sn_id?: string | null;
    caused_by_change_sn_id?: string | null;
    problem_sn_id?: string | null;
    probable_cause?: string | null;
    knowledge_sn_id?: string | null;
    classification?: string | null;
    caller_location?: string | null;
    caller_department?: string | null;
    caller_region?: string | null;
    first_category?: string | null;
    second_category?: string | null;
    third_category?: string | null;
    fourth_category?: string | null;
    // ServiceNow tags as an array of tag names (backend stores JSONB).
    sys_tags?: string[] | null;
}

export interface Request {
    oid: string;
    stable_id: string;
    object_type: 'request';
    title: string;
    description: string | null;
    state: string;
    priority: string | null;
    urgency: string | null;
    category: string | null;
    subcategory: string | null;
    impact: string | null;
    item: string | null;
    request_item: string | null;
    caller_name: string | null;
    assigned_to_name: string | null;
    sn_id: string | null;
    channel: string | null;

    // Relationships
    // Phase 3 typed actor: actor_oid is nullable (external actors have none).
    actor_oid: string | null;
    actor_type: ActorType;
    actor_stable_id: string | null;
    actor_role: string;
    fact: string | null;
    source_system: string | null;
    fact_embedding_id: string | null;
    fact_embedded_at: string | null;
    assigned_to_oid: string | null;
    service_catalog_oid: string | null;
    service_catalog_override_oid: string | null;
    service_type_oid: string | null;
    service_type_override_oid: string | null;
    configuration_item_oid: string | null;
    assigned_group: string | null;
    chat_transcripts: Record<string, unknown> | null;

    created_at: string;
    updated_at: string;
    effective_at: string;

    // ---------------------------------------------------------------------
    // Phase 2 — ServiceNow authoritative fields (request-side subset).
    // Mirror of the incident set with the request-specific additions
    // (agent_updated_at, close_notes, contact_type, catalog, request_sn_id)
    // and without the incident-only fields (resolved_at, last_reopened_*,
    // severity, reopen_count, change_request, problem, probable_cause,
    // parent_incident).
    // ---------------------------------------------------------------------
    source_created_at?: string | null;
    source_updated_at?: string | null;
    source_opened_at?: string | null;
    source_closed_at?: string | null;
    source_sla_due?: string | null;
    source_due_date?: string | null;
    source_expected_start?: string | null;
    source_agent_updated_at?: string | null;

    opened_by_name?: string | null;
    closed_by_name?: string | null;
    close_notes?: string | null;
    contact_type?: string | null;

    location?: string | null;
    department?: string | null;
    company?: string | null;

    service?: string | null;
    service_offering?: string | null;
    configuration_item_display?: string | null;
    catalog?: string | null;

    made_sla?: boolean | null;
    escalation?: number | null;
    reassignment_count?: number | null;

    business_duration_sec?: number | null;
    business_duration_w_pause_sec?: number | null;
    duration_sec?: number | null;
    resolve_time_sec?: number | null;

    parent_sn_id?: string | null;
    request_sn_id?: string | null;
    knowledge_sn_id?: string | null;
    correlation_id?: string | null;
    correlation_display?: string | null;
}

/**
 * Incident SLA row. One-to-many off Incident via incident_oid.
 *
 * See backend docs/superpowers/plans/2026-04-24-ops-dashboard-phase-2-incident-slas.md.
 * Source is the ServiceNow ``task_sla`` record; ``sn_sys_id`` is the
 * stable upstream key. Duration columns store integer seconds parsed
 * from SN's English-prose format at ingest.
 */
export interface IncidentSla {
    oid: string;
    incident_oid: string;
    sn_sys_id: string;
    sn_incident_number: string;

    sla_name: string | null;
    schedule: string | null;
    schedule_timezone: string | null;

    stage: string | null;
    has_breached: boolean | null;
    made_sla: boolean | null;

    percentage: number | null;
    business_percentage: number | null;

    start_time: string | null;
    end_time: string | null;
    breach_time: string | null;
    original_breach_time: string | null;
    sla_due: string | null;

    business_duration_sec: number | null;
    business_time_left_sec: number | null;
    actual_elapsed_time_sec: number | null;
    pause_duration_sec: number | null;
    business_pause_duration_sec: number | null;

    source_system: string;
    created_at: string;
    updated_at: string;
}

export interface IncidentSlaListResponse {
    items: IncidentSla[];
    total: number;
}

export interface IncidentCreate {
    stable_id?: string | null;
    // Phase 3 typed actor (defaults to 'worker' server-side).
    actor_type?: ActorType;
    actor_oid?: string | null;
    actor_stable_id?: string | null;
    actor_role?: string | null;
    title: string;
    description?: string | null;
    priority?: string | null;
    urgency?: string | null;
    category?: string | null;
    subcategory?: string | null;
    impact?: string | null;
    caller_name?: string | null;
    assigned_to_name?: string | null;
    sn_id?: string | null;
    channel?: string | null;
    assigned_to_oid?: string | null;
    service_catalog_oid?: string | null;
    service_catalog_override_oid?: string | null;
    service_type_oid?: string | null;
    service_type_override_oid?: string | null;
    configuration_item_oid?: string | null;
    assigned_group?: string | null;
    chat_transcripts?: Record<string, unknown> | null;
    source_system?: string | null;
    fact?: string | null;
    created_at?: string;
    updated_at?: string;
    effective_at?: string;
}

export interface RequestCreate {
    stable_id?: string | null;
    // Phase 3 typed actor (defaults to 'worker' server-side).
    actor_type?: ActorType;
    actor_oid?: string | null;
    actor_stable_id?: string | null;
    actor_role?: string | null;
    title: string;
    description?: string | null;
    state: string;
    priority?: string | null;
    urgency?: string | null;
    category?: string | null;
    subcategory?: string | null;
    impact?: string | null;
    item?: string | null;
    request_item?: string | null;
    caller_name?: string | null;
    assigned_to_name?: string | null;
    sn_id?: string | null;
    channel?: string | null;
    assigned_to_oid?: string | null;
    service_catalog_oid?: string | null;
    service_catalog_override_oid?: string | null;
    service_type_oid?: string | null;
    service_type_override_oid?: string | null;
    configuration_item_oid?: string | null;
    assigned_group?: string | null;
    chat_transcripts?: Record<string, unknown> | null;
    source_system?: string | null;
    fact?: string | null;
    created_at?: string;
    updated_at?: string;
    effective_at?: string;
}

export interface IncidentListResponse {
    items: Incident[];
    total: number;
    skip: number;
    limit: number;
}

export interface IncidentListParams {
    state?: string;
    priority?: string;
    stable_id?: string;
    actor_oid?: string;
    created_at_from?: string;
    created_at_to?: string;
    updated_at_from?: string;
    updated_at_to?: string;
    effective_at_from?: string;
    effective_at_to?: string;
    // AI classification — single-value backend filter (frontend dashboard
    // does multi-select client-side; this exists for typed callers
    // such as MCP, scripts, or future pages that want server-side filtering).
    ai_category?: string;
    skip?: number;
    limit?: number;
}

export interface RequestListResponse {
    items: Request[];
    total: number;
    skip: number;
    limit: number;
}

export interface RequestListParams {
    state?: string;
    priority?: string;
    stable_id?: string;
    actor_oid?: string;
    created_at_from?: string;
    created_at_to?: string;
    updated_at_from?: string;
    updated_at_to?: string;
    effective_at_from?: string;
    effective_at_to?: string;
    skip?: number;
    limit?: number;
}

export interface IncidentUpdate {
    title: string;
    stable_id?: string | null;
    description?: string | null;
    priority?: string | null;
    urgency?: string | null;
    category?: string | null;
    subcategory?: string | null;
    impact?: string | null;
    caller_name?: string | null;
    assigned_to_name?: string | null;
    sn_id?: string | null;
    channel?: string | null;
    assigned_to_oid?: string | null;
    service_catalog_oid?: string | null;
    service_catalog_override_oid?: string | null;
    service_type_oid?: string | null;
    service_type_override_oid?: string | null;
    configuration_item_oid?: string | null;
    assigned_group?: string | null;
    chat_transcripts?: Record<string, unknown> | null;
    source_system?: string | null;
    fact?: string | null;
    state?: string;
    created_at?: string;
    updated_at?: string;
    effective_at?: string;
    // AI classification — DAG-written; included so internal tools can post-correct.
    ai_category?: string | null;
    ai_category_reason?: string | null;
    ai_category_at?: string | null;
    // Human review override of ai_category — also writable via PATCH /incidents/{oid}/review.
    review_category?: string | null;
}

export interface RequestUpdate {
    title: string;
    stable_id?: string | null;
    description?: string | null;
    priority?: string | null;
    urgency?: string | null;
    category?: string | null;
    subcategory?: string | null;
    impact?: string | null;
    item?: string | null;
    request_item?: string | null;
    caller_name?: string | null;
    assigned_to_name?: string | null;
    sn_id?: string | null;
    channel?: string | null;
    assigned_to_oid?: string | null;
    service_catalog_oid?: string | null;
    service_catalog_override_oid?: string | null;
    service_type_oid?: string | null;
    service_type_override_oid?: string | null;
    configuration_item_oid?: string | null;
    assigned_group?: string | null;
    chat_transcripts?: Record<string, unknown> | null;
    source_system?: string | null;
    fact?: string | null;
    state?: string;
    created_at?: string;
    updated_at?: string;
    effective_at?: string;
}

export type InteractionActionType = 'enter' | 'click' | 'send_msg';
export type InteractionSortBy = 'created_at' | 'ingested_at' | 'updated_at';
export type InteractionOrder = 'asc' | 'desc';

export interface Interaction {
    oid: string;
    stable_id: string;
    object_type: 'interaction';
    source_system: string;
    actor_stable_id: string;
    action_type: InteractionActionType;
    content_text: string | null;
    content_raw: Record<string, unknown> | null;
    response_text: string | null;
    response_raw: Record<string, unknown> | null;
    created_at: string;
    ingested_at: string;
    updated_at: string;

    // SSC dashboard — AI-derived defaults (populated by digest_interactions DAG; nullable until then).
    // Service catalog / type follow the project's default+_override naming:
    //   service_catalog_oid       — L3 leaf under IT Services (ITSC0000)
    //   service_type_oid          — one of the ITST leaves (Enquiry/Faulty/Requirement)
    // Effective value at render: COALESCE(<override>_oid, <default>_oid).
    ai_code?: ReviewCode | null;
    service_catalog_oid?: string | null;
    service_type_oid?: string | null;
    helpful_score?: number | null;

    // Chatbot per-cycle latency (single-chats event_tracking timing); the full
    // event_tracking trace is retained inside content_raw.record.flow_states.
    react_seconds?: number | null;
    response_seconds?: number | null;
    cycle_seconds?: number | null;

    // SSC dashboard — human review (edited via PATCH /review)
    review_code?: ReviewCode | null;
    service_catalog_override_oid?: string | null;
    service_type_override_oid?: string | null;
    review_needs_optimization?: boolean | null;
    review_optimization_notes?: string | null;
    review_completed_at?: string | null;
    review_completed_by_oid?: string | null;
}

export interface InteractionListParams {
    stable_id?: string;
    stable_id_prefix?: string;
    actor_stable_id?: string;
    source_system?: string;
    created_at_from?: string;
    created_at_to?: string;
    skip?: number;
    limit?: number;
    sort_by?: InteractionSortBy;
    order?: InteractionOrder;
}

export interface InteractionListResponse {
    items: Interaction[];
    total: number;
    skip: number;
    limit: number;
    sort_by: InteractionSortBy;
    order: InteractionOrder;
}

// ============================================================================
// Campaign Notification Batch Types
// ============================================================================

export type NotificationBatchChannel = 'wecom_bot' | 'wecom_ops_bot';

export type NotificationBatchStatus =
    | 'ready'
    | 'running'
    | 'partially_completed'
    | 'completed'
    | 'cancelled';

export type NotificationStatus = 'created' | 'sent' | 'failed' | 'cancelled';

export interface NotificationContentTextBlock {
    type: 'text';
    text: string;
}

export interface NotificationContentLinkBlock {
    type: 'link';
    text: string;
    url: string;
}

export interface NotificationContentTitleBlock {
    type: 'title';
    text: string;
}

export type NotificationContentBlock =
    | NotificationContentTextBlock
    | NotificationContentLinkBlock
    | NotificationContentTitleBlock;

export interface NotificationBatch {
    oid: string;
    name: string;
    channel: NotificationBatchChannel;
    status: NotificationBatchStatus;
    run_id: string | null;
    creator_account: string | null;
    total_count: number;
    image_type?: string | null;
    image_id?: string | null;
    image_base64?: string | null;
    created_at: string;
    updated_at: string;
}

export interface NotificationBatchCreate {
    name: string;
    channel?: NotificationBatchChannel;
    creator_account?: string;
    image_type?: string | null;
    image_id?: string | null;
    image_base64?: string | null;
    notifications?: NotificationCreate[];
}

export interface NotificationBatchUpdate {
    name?: string;
    channel?: NotificationBatchChannel;
    image_type?: string | null;
    image_id?: string | null;
    image_base64?: string | null;
}

export interface NotificationBatchActionRequest {
    action: 'trigger' | 'cancel';
}

export interface NotificationBatchListParams {
    status?: NotificationBatchStatus;
    channel?: NotificationBatchChannel;
    skip?: number;
    limit?: number;
}

export interface NotificationBatchListResponse {
    items: NotificationBatch[];
    total: number;
    skip: number;
    limit: number;
}

export interface Notification {
    oid: string;
    notification_batch_oid: string;
    receiver_stable_id: string;
    receiver_oid: string | null;
    external_source: string | null;
    content_blocks: NotificationContentBlock[];
    status: NotificationStatus;
    scheduled_at: string | null;
    error_message: string | null;
    created_at: string;
    updated_at: string;
}

export interface NotificationCreate {
    receiver_stable_id: string;
    receiver_oid?: string | null;
    /**
     * Marks a receiver the caller knows may not exist in the worker table, granting the
     * backend permission to store a null receiver_oid. Delivery only needs the stable id
     * (it is the WeCom user_id), so such a receiver is still notifiable. Without this,
     * an unresolvable receiver is rejected with 422 so typos cannot slip through.
     */
    external_source?: string | null;
    content_blocks: NotificationContentBlock[];
    status?: NotificationStatus;
    scheduled_at?: string | null;
    error_message?: string | null;
}

export interface NotificationUpdate {
    receiver_oid?: string | null;
    content_blocks?: NotificationContentBlock[];
    scheduled_at?: string | null;
}

export interface NotificationListParams {
    status?: NotificationStatus;
    receiver_stable_id?: string;
    scheduled_at_from?: string;
    scheduled_at_to?: string;
    skip?: number;
    limit?: number;
}

export interface NotificationListResponse {
    items: Notification[];
    total: number;
    skip: number;
    limit: number;
}

// ============================================================================
// Campaign Survey Batch Types
// ============================================================================

export type SurveyBatchStatus = 'draft' | 'collecting' | 'closed' | 'cancelled';

export type SurveyStatus = 'not_started' | 'submitted' | 'revoked' | 'expired';

export type SurveyQuestionType = 'single_select' | 'multi_select' | 'text';

export interface SurveyQuestionOption {
    option_id: string;
    label: string;
}

interface BaseSurveyQuestion {
    question_id: string;
    type: SurveyQuestionType;
    title: string;
    required: boolean;
}

export interface SurveySingleSelectQuestion extends BaseSurveyQuestion {
    type: 'single_select';
    options: SurveyQuestionOption[];
}

export interface SurveyMultiSelectQuestion extends BaseSurveyQuestion {
    type: 'multi_select';
    options: SurveyQuestionOption[];
}

export interface SurveyTextQuestion extends BaseSurveyQuestion {
    type: 'text';
}

export type SurveyQuestion =
    | SurveySingleSelectQuestion
    | SurveyMultiSelectQuestion
    | SurveyTextQuestion;

export interface SurveyQuestions {
    intro: string;
    questions: SurveyQuestion[];
}

export interface SurveySingleSelectAnswer {
    question_id: string;
    type: 'single_select';
    selected_option_id: string;
}

export interface SurveyMultiSelectAnswer {
    question_id: string;
    type: 'multi_select';
    selected_option_ids: string[];
}

export interface SurveyTextAnswer {
    question_id: string;
    type: 'text';
    text: string;
}

export type SurveyAnswer =
    | SurveySingleSelectAnswer
    | SurveyMultiSelectAnswer
    | SurveyTextAnswer;

export interface SurveyAnswerPayload {
    answers: SurveyAnswer[];
}

export interface SurveyBatch {
    oid: string;
    name: string;
    status: SurveyBatchStatus;
    creator_account: string | null;
    total_count: number;
    image_type?: string | null;
    image_id?: string | null;
    image_base64?: string | null;
    created_at: string;
    updated_at: string;
}

export interface SurveyBatchCreate {
    name: string;
    creator_account?: string;
    image_type?: string | null;
    image_id?: string | null;
    image_base64?: string | null;
    surveys?: SurveyCreate[];
}

export interface SurveyBatchUpdate {
    name?: string;
    image_type?: string | null;
    image_id?: string | null;
    image_base64?: string | null;
}

export interface SurveyBatchActionRequest {
    action: 'publish' | 'close' | 'reopen' | 'cancel';
}

export interface SurveyBatchListParams {
    status?: SurveyBatchStatus;
    skip?: number;
    limit?: number;
}

export interface SurveyBatchListResponse {
    items: SurveyBatch[];
    total: number;
    skip: number;
    limit: number;
}

export interface Survey {
    oid: string;
    survey_batch_oid: string;
    receiver_stable_id: string;
    /**
     * `null` when `external_source` is non-null — externally-sourced surveys
     * may carry a respondent who is not a known Worker. For native surveys
     * (external_source === null) this is always a valid Worker OID.
     */
    receiver_oid: string | null;
    /** Provenance marker for surveys imported from outside it-aware (e.g. "feishu-forms", "servicenow"). */
    external_source: string | null;
    /** Upstream record id when external_source is set (e.g. "AINST0137544" for a ServiceNow ASMT instance). */
    external_id: string | null;
    /** Typed pointer label, paired with context_oid (e.g. "incident", "request"). */
    context_type: string | null;
    /** 22-char ULID of the linked object, paired with context_type. */
    context_oid: string | null;
    survey_questions: SurveyQuestions;
    survey_answer: SurveyAnswerPayload | null;
    status: SurveyStatus;
    submitted_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface SurveyCreate {
    receiver_stable_id: string;
    receiver_oid?: string | null;
    external_source?: string | null;
    external_id?: string | null;
    context_type?: string | null;
    context_oid?: string | null;
    survey_questions: SurveyQuestions;
}

export interface SurveyUpdate {
    receiver_oid?: string | null;
    survey_questions?: SurveyQuestions;
    context_type?: string | null;
    context_oid?: string | null;
}

export interface SurveySubmitActionRequest {
    action: 'submit';
    survey_answer: SurveyAnswerPayload;
}

export interface SurveyRevokeActionRequest {
    action: 'revoke';
}

export type SurveyActionRequest = SurveySubmitActionRequest | SurveyRevokeActionRequest;

export interface SurveyListParams {
    status?: SurveyStatus;
    receiver_stable_id?: string;
    external_source?: string;
    context_type?: string;
    context_oid?: string;
    external_id?: string;
    submitted_at_from?: string;
    submitted_at_to?: string;
    skip?: number;
    limit?: number;
}

export interface SurveyListResponse {
    items: Survey[];
    total: number;
    skip: number;
    limit: number;
}

export interface CrossBatchSurveyListParams {
    receiver_stable_id?: string;
    survey_status?: SurveyStatus;
    survey_batch_status?: SurveyBatchStatus;
    survey_batch_oid?: string;
    external_source?: string;
    context_type?: string;
    context_oid?: string;
    external_id?: string;
    skip?: number;
    limit?: number;
}

// ============================================================================
// Analysis (Insights)
// ============================================================================

export type AnalysisSourceType = 'survey';

export type AnalysisSemantic = 'positive' | 'negative' | null;

export type AnalysisIntent = 'request' | 'bug' | 'complaint' | 'praise' | 'suggestion' | null;

export interface Analysis {
    oid: string;
    worker_oid: string;
    source_type: AnalysisSourceType;
    source_oid: string;
    source_batch_oid: string | null;
    topic: string;
    keywords: string[] | null;
    fact: string | null;
    semantic: AnalysisSemantic;
    intent: AnalysisIntent;
    service_catalog_oid: string | null;
    service_catalog_override_oid: string | null;
    service_type_oid: string | null;
    service_type_override_oid: string | null;
    configuration_item_oid: string | null;
    created_at: string;
    updated_at: string;
    effective_at: string;
}

export interface AnalysisCreate {
    worker_oid: string;
    source_type: AnalysisSourceType;
    source_oid: string;
    source_batch_oid?: string | null;
    topic: string;
    effective_at?: string;
    keywords?: string[] | null;
    fact?: string | null;
    semantic?: AnalysisSemantic;
    intent?: AnalysisIntent;
    service_catalog_oid?: string | null;
    service_catalog_override_oid?: string | null;
    service_type_oid?: string | null;
    service_type_override_oid?: string | null;
    configuration_item_oid?: string | null;
}

export interface AnalysisUpdate {
    keywords?: string[] | null;
    fact?: string | null;
    semantic?: AnalysisSemantic;
    intent?: AnalysisIntent;
    service_catalog_oid?: string | null;
    service_catalog_override_oid?: string | null;
    service_type_oid?: string | null;
    service_type_override_oid?: string | null;
    configuration_item_oid?: string | null;
}

export interface AnalysisListParams {
    worker_oid?: string;
    source_type?: AnalysisSourceType;
    source_oid?: string;
    source_batch_oid?: string;
    topic?: string;
    semantic?: 'positive' | 'negative';
    intent?: 'request' | 'bug' | 'complaint' | 'praise' | 'suggestion';
    effective_at_from?: string;
    effective_at_to?: string;
    skip?: number;
    limit?: number;
}

export interface AnalysisListResponse {
    items: Analysis[];
    total: number;
    skip: number;
    limit: number;
}

// ============================================================================
// Scenario Types (Journeys)
// ============================================================================

export interface ScenarioProfile {
    description?: string | null;
    notes?: string | null;
    key_topics?: string[] | null;
}

export interface Scenario {
    oid: string;
    worker_oid: string;
    scenario_type: 'onboarding';
    scenario_profile: ScenarioProfile | null;
    effective_at: string;
    created_at: string;
    updated_at: string;
}

export interface ScenarioCreate {
    worker_oid: string;
    scenario_type: string;
    effective_at: string;
    scenario_profile?: ScenarioProfile;
}

export interface ScenarioUpdate {
    scenario_type?: string;
    scenario_profile?: ScenarioProfile;
}

export interface ScenarioListParams {
    worker_oid?: string;
    scenario_type?: string;
    effective_at_from?: string;
    effective_at_to?: string;
    skip?: number;
    limit?: number;
}

export interface ScenarioListResponse {
    items: Scenario[];
    total: number;
    skip: number;
    limit: number;
}

// ============================================================================
// Worker Cluster Types
// ============================================================================

export interface ClusterProfile {
    name: string;
    description: string;
    key_behaviors: string[] | null;
    pain_points: string[] | null;
    best_practices: string[] | null;
    sla_recommendation: string | null;
}

export interface ScalerParam {
    mean: number;
    scale: number;
}

export interface WorkerCluster {
    worker_oid: string;
    cluster_label: number;
    cluster_probability: number;
    outlier_score: number;
    cluster_name: string | null;
    cluster_profile: ClusterProfile | null;
    behavior_features: Record<string, number> | null;
    label_features: Record<string, number> | null;
    pca_3d: [number, number, number] | null;
    behavior_scales: Record<string, ScalerParam> | null;
    run_id: string;
    computed_at: string;
}

export interface WorkerClusterListParams {
    skip?: number;
    limit?: number;
    cluster_label?: number;
    run_id?: string;
}

export interface WorkerClusterListResponse {
    items: WorkerCluster[];
    total: number;
    skip: number;
    limit: number;
}

export interface ClusterInfo {
    cluster_label: number;
    cluster_name: string | null;
    size: number;
    percentage: number;
    cluster_profile: ClusterProfile | null;
}

export interface ClusterSummaryResponse {
    run_id: string | null;
    computed_at: string | null;
    total_workers: number;
    n_clusters: number;
    noise_count: number;
    clusters: ClusterInfo[];
}

// ============================================================================
// SSC Dashboard — Worker Context (enriched map for F3)
// ============================================================================

export interface WorkerContext {
    stable_id: string;
    region: string | null;
    country: string | null;
    department: string | null;
}

// ==================== Agent ====================

export interface Agent {
    oid: string;
    name: string;
    agent_id: string;
    agent_key: string | null;
    agent_admin_key: string | null;
    agent_platform: string;
    contact_worker_oid: string;
    description: string | null;
    prompt_oids: string[];   // attached role/persona prompts (injected via the agent API)
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AgentCreate {
    name: string;
    agent_id: string;
    agent_key?: string;
    agent_admin_key?: string;
    agent_platform: string;
    contact_worker_oid: string;
    description?: string;
    prompt_oids?: string[];
}

export interface AgentUpdate {
    name?: string;
    agent_id?: string;
    agent_key?: string;
    agent_admin_key?: string;
    agent_platform?: string;
    contact_worker_oid?: string;
    description?: string;
    prompt_oids?: string[];
    is_active?: boolean;
}

export interface AgentListResponse {
    items: Agent[];
    total: number;
    skip: number;
    limit: number;
}

// ==================== Prompt ====================
// A Prompt is a reusable role/persona instruction bundle. Agents are generic;
// their behaviour comes from the prompts attached to them (agent.prompt_oids),
// which the dispatcher prepends as a role preamble to the first message of each
// agent conversation (background_knowledge is reserved for the handoff packet).
// A "skill" is just one `kind` of prompt.

export interface Prompt {
    oid: string;
    name: string;
    display_name: string | null;
    description: string | null;
    kind: string;
    content: string | null;
    metadata: Record<string, unknown> | null;
    version: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface PromptListItem {
    oid: string;
    name: string;
    display_name: string | null;
    kind: string;
    is_active: boolean;
    version: number;
}

export interface PromptListResponse {
    items: PromptListItem[];
    total: number;
    skip: number;
    limit: number;
}

export interface PromptCreate {
    name: string;
    display_name?: string;
    description?: string;
    kind?: string;
    content: string;
    metadata?: Record<string, unknown>;
}

export interface PromptUpdate {
    display_name?: string;
    description?: string;
    kind?: string;
    content?: string;
    metadata?: Record<string, unknown>;
    is_active?: boolean;
}

// ==================== System ====================
// Phase 3: objects.systems is a first-class identity for non-human,
// non-AI actors (ServiceNow ingest, Airflow scheduler, etc.). Mirrors
// Agent shape but contact_worker_oid is nullable (infrastructure
// systems are ownerless) and there are no agent_key / admin_key /
// workspace_id analogs.

export interface System {
    oid: string;
    name: string;
    system_id: string;
    system_platform: string;
    contact_worker_oid: string | null;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface SystemCreate {
    name: string;
    system_id: string;
    system_platform: string;
    contact_worker_oid?: string;
    description?: string;
}

export interface SystemUpdate {
    name?: string;
    system_platform?: string;
    contact_worker_oid?: string;
    description?: string;
    is_active?: boolean;
}

export interface SystemListResponse {
    items: System[];
    total: number;
    skip: number;
    limit: number;
}

// ==================== Ticket ====================

export type TicketStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled';

export interface Ticket {
    oid: string;
    title: string;
    body: string | null;
    status: TicketStatus;
    assignee_account_oid: string | null;
    created_by_account_oid: string;
    parent_ticket_oid: string | null;
    channel_message_oid: string | null;
    channel_oid: string | null;
    tags: string[];
    priority: number;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
    // Populated on the detail GET; true while a run is queued/claimed/running.
    has_active_run: boolean | null;
    // Populated on the detail GET; the latest run's conversation_id.
    conversation_id?: string | null;
}

export interface TicketCreate {
    title: string;
    body?: string;
    status?: TicketStatus;
    assignee_account_oid?: string;
    parent_ticket_oid?: string;
    tags?: string[];
    priority?: number;
}

export interface TicketUpdate {
    title?: string;
    body?: string;
    status?: TicketStatus;
    assignee_account_oid?: string;
    parent_ticket_oid?: string;
    tags?: string[];
    priority?: number;
}

export interface TicketListResponse {
    items: Ticket[];
    total: number;
    skip: number;
    limit: number;
}

// ==================== Run (agentops dispatch execution) ====================
// A Run is one execution of an agent against a ticket (or ad-hoc payload).
// The dispatcher claims a queued run, executes it, and records status / result
// / error. Runs are read-only in the UI.

export type RunStatus = string;

export interface Run {
    oid: string;
    agent_oid: string;
    ticket_oid: string | null;
    status: RunStatus;
    priority: number;
    claim_token: string | null;
    claimed_at: string | null;
    parent_run_oid: string | null;
    attempt: number;
    max_attempts: number;
    failure_reason: string | null;
    conversation_id: string | null;
    started_at: string | null;
    completed_at: string | null;
    payload: Record<string, unknown> | null;
    result: Record<string, unknown> | null;
    error: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

export interface RunListResponse {
    items: Run[];
    total: number;
    skip: number;
    limit: number;
}

// ==================== ThreadMessage (ticket conversation) ====================
// v2: replaces the old `TicketComment`. A ticket's thread interleaves human
// comments, agent replies (linked to the Run that produced them), and system
// notes. Posting a `human_comment` on an agent-assigned ticket dispatches the
// assigned agent, reusing the prior run's conversation_id to continue the
// same session.

export type ThreadMessageKind = 'human_comment' | 'agent_reply' | 'system_note';

export interface ThreadMessage {
    oid: string;
    ticket_oid: string;
    kind: ThreadMessageKind;
    body: string;
    author_account_oid: string | null; // set for human_comment
    run_oid: string | null;            // set for agent_reply
    conversation_id: string | null;    // hydrated from run_oid (agent_reply)
    reply_to_message_oid: string | null;
    created_at: string;
}

export interface ThreadMessageCreate {
    ticket_oid: string;
    body: string;
    reply_to_message_oid?: string;
}

// GET /tickets/{oid}/thread returns just { items } (no pagination envelope).
export interface ThreadListResponse {
    items: ThreadMessage[];
}

// ==================== Ticket lineage (handoff/traceability) ====================

export interface TicketGraphAssignee {
    type: 'agent' | 'human';
    account_oid: string;
    agent_oid?: string;
    name: string | null;
    is_agent: boolean;
}

export interface TicketGraphNode {
    oid: string;
    title: string;
    status: TicketStatus;
    depth: number;
    assignee: TicketGraphAssignee | null;
    has_active_run: boolean;
    run_count: number;
    handoff_count: number;
}

export interface TicketGraphEdge {
    parent_oid: string;
    child_oid: string;
}

export interface TicketGraph {
    root_oid: string;
    focus_oid: string;
    nodes: TicketGraphNode[];
    edges: TicketGraphEdge[];
}

export interface TicketTraceEvent {
    ts: string;
    kind: string;
    actor_type?: string | null;
    actor_oid?: string | null;
    run_oid?: string | null;
    agent_oid?: string | null;
    session?: string | null;
    author_account_oid?: string | null;
    body?: string;
    failure_reason?: string | null;
    details?: Record<string, unknown> | null;
}

export interface TicketTrace {
    ticket_oid: string;
    events: TicketTraceEvent[];
}

// ── FAQ Monthly Report ────────────────────────────────────────────────────────

export interface CodeBreakdownItem {
    code: string;
    display: string;
    count: number;
    percentage: number;
}

export interface MonthStats {
    start_date: string;
    end_date: string;
    label: string;
    breakdown: CodeBreakdownItem[];
    grand_total: number;
    unique_visitors: number;
    faq_resolution_rate: number;
    ok_rate: number;
    imp_rate: number;
    human_escalation_rate: number;
    wecom_incident_count: number;
}

export interface FAQEnquiryItem {
    code: string;
    name: string;
    count: number;
    percentage: number;
    sample_question?: string | null;
}

export interface InteractionFAQReport {
    current: MonthStats;
    previous: MonthStats;
    top5_faq: FAQEnquiryItem[];
}

// ── Incident Monthly Report ─────────────────────────────────────────────────

export interface IncidentCategoryBreakdownItem {
    code: string;
    display: string;
    count: number;
    percentage: number;
}

export interface IncidentMonthStats {
    start_date: string;
    end_date: string;
    label: string;
    breakdown: IncidentCategoryBreakdownItem[];
    grand_total: number;
    resolved_count: number;
    high_priority_count: number;
    overdue_count: number;
    state_breakdown: IncidentCategoryBreakdownItem[];
    priority_breakdown: IncidentCategoryBreakdownItem[];
}

export interface IncidentTop5Item {
    name: string;
    count: number;
    percentage: number;
}

export interface ChatbotEscalationStats {
    start_date: string;
    end_date: string;
    label: string;
    total_sessions: number;
    meaningful_sessions: number;
    escalated_sessions: number;
    bot_handled_sessions: number;
    direct_escalation_sessions: number;
    after_bot_escalation_sessions: number;
    escalation_rate: number;
    bot_handled_rate: number;
    direct_escalation_rate: number;
    after_bot_rate: number;
    adjusted_bot_failure_rate: number;
    avg_interactions_before_escalation: number;
    repeat_escalator_count: number;
}

export interface IncidentMonthlyReportData {
    current: IncidentMonthStats;
    previous: IncidentMonthStats;
    top5_assigned_group: IncidentTop5Item[];
    top5_service_catalog: IncidentTop5Item[];
    chatbot_escalation: ChatbotEscalationStats | null;
    chatbot_escalation_previous: ChatbotEscalationStats | null;
}

// ITOps Dashboard — /dashboards/itopsdashboard/incident-sla-monthly

export interface IncidentSlaCell {
    met: number;
    total: number;
    pct: number | null; // null when total === 0 (renders as an em dash)
}

export interface IncidentSlaMonthRow {
    month: string; // "2026-08"; "2026" for the cumulative row
    is_partial: boolean;
    response: IncidentSlaCell;
    p1: IncidentSlaCell;
    p2: IncidentSlaCell;
    p3: IncidentSlaCell;
    p4: IncidentSlaCell;
    resolution_subtotal: IncidentSlaCell;
    all_sla: IncidentSlaCell;
}

export interface IncidentSlaMonthlyReportData {
    year: number;
    months: IncidentSlaMonthRow[];
    cumulative: IncidentSlaMonthRow;
    generated_at: string;
}
