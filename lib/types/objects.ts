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
// Activity Types (Incidents, Requests, Inquiries, Interactions)
// ============================================================================

export interface Incident {
    oid: string;
    stable_id: string | null;
    object_type: 'incident';
    title: string;
    description: string | null;
    state: string;
    priority: string | null;
    urgency: string | null;
    channel: string | null;

    // Relationships
    actor_oid: string;
    actor_role: string;
    fact: string | null;
    source_system: string | null;
    fact_embedding_id: string | null;
    fact_embedded_at: string | null;
    assigned_to_oid: string | null;
    service_catalog_oid: string | null;
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
    channel: string | null;

    // Relationships
    actor_oid: string;
    actor_role: string;
    fact: string | null;
    source_system: string | null;
    fact_embedding_id: string | null;
    fact_embedded_at: string | null;
    assigned_to_oid: string | null;
    service_catalog_oid: string | null;
    configuration_item_oid: string | null;
    assigned_group: string | null;
    chat_transcripts: Record<string, unknown> | null;

    created_at: string;
    updated_at: string;
    effective_at: string;
}

export interface IncidentCreate {
    stable_id?: string | null;
    actor_oid: string;
    actor_role?: string | null;
    title: string;
    description?: string | null;
    priority?: string | null;
    urgency?: string | null;
    channel?: string | null;
    assigned_to_oid?: string | null;
    service_catalog_oid?: string | null;
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
    actor_oid: string;
    actor_role?: string | null;
    title: string;
    description?: string | null;
    state: string;
    priority?: string | null;
    urgency?: string | null;
    channel?: string | null;
    assigned_to_oid?: string | null;
    service_catalog_oid?: string | null;
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

export interface Inquiry {
    oid: string;
    object_type: 'inquiry';
    topic: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: any[] | null;
    state: string;

    // Relationships
    actor_oid: string;
    actor_role: string;
    fact: string | null;
    source_system?: string | null;
    fact_embedding_id: string | null;
    fact_embedded_at: string | null;
    service_catalog_oid: string | null;
    configuration_item_oid: string | null;

    created_at: string;
    updated_at: string;
    effective_at: string;
}

export interface InquiryCreate {
    actor_oid: string;
    actor_role?: string | null;
    topic?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages?: any[] | null;
    service_catalog_oid?: string | null;
    configuration_item_oid?: string | null;
    fact?: string | null;
    source_system?: string | null;
    created_at?: string;
    updated_at?: string;
    effective_at?: string;
}

export interface InquiryListResponse {
    items: Inquiry[];
    total: number;
    skip: number;
    limit: number;
}

export interface InquiryListParams {
    state?: string;
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
    channel?: string | null;
    assigned_to_oid?: string | null;
    service_catalog_oid?: string | null;
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

export interface RequestUpdate {
    title: string;
    stable_id?: string | null;
    description?: string | null;
    priority?: string | null;
    urgency?: string | null;
    channel?: string | null;
    assigned_to_oid?: string | null;
    service_catalog_oid?: string | null;
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

export interface InquiryUpdate {
    topic?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages?: any[] | null;
    service_catalog_oid?: string | null;
    configuration_item_oid?: string | null;
    fact?: string | null;
    source_system?: string | null;
    state?: string;
    created_at?: string;
    updated_at?: string;
    effective_at?: string;
}

export type InteractionActionType = 'enter' | 'click' | 'send_msg';
export type InteractionAssignmentStatus = 'assigned' | 'deferred' | null;
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
    assignment_status: InteractionAssignmentStatus;
    assigned_inquiry_oid: string | null;
    assignment_updated_at: string | null;
    assignment_log: Record<string, unknown> | null;
    created_at: string;
    ingested_at: string;
    updated_at: string;

    // SSC dashboard — AI-derived (populated by digest_interactions DAG; nullable until then)
    ai_ci?: string | null;
    ai_code?: ReviewCode | null;
    helpful_score?: number | null;

    // SSC dashboard — human review (edited via PATCH /review)
    review_ci?: string | null;
    review_code?: ReviewCode | null;
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
    assignment_status?: 'assigned' | 'deferred' | 'null';
    assigned_inquiry_oid?: string;
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
    receiver_oid: string;
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
    survey_questions: SurveyQuestions;
}

export interface SurveyUpdate {
    receiver_oid?: string | null;
    survey_questions?: SurveyQuestions;
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
    configuration_item_oid?: string | null;
}

export interface AnalysisUpdate {
    keywords?: string[] | null;
    fact?: string | null;
    semantic?: AnalysisSemantic;
    intent?: AnalysisIntent;
    service_catalog_oid?: string | null;
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
