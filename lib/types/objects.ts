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
    is_vip: boolean;
    vip_type: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface WorkerProfile {
    worker_oid: string;
    summary: string | null;
    summary_updated_at: string | null;
    topics: string[] | null;
    topics_updated_at: string | null;
    tags: string[] | null;
    tags_updated_at: string | null;
}

export interface WorkerProfileUpsert {
    summary?: string | null;
    topics?: string[] | null;
    tags?: string[] | null;
}

export interface WorkerHardware {
    oid: string;
    worker_oid: string;
    hardware_type: string;
    tracking_id: string | null;
    serial_number: string | null;
    model: string | null;
    assignment_date: string;
    renew_eligible_date: string | null;
    notes: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface WorkerHardwareCreate {
    hardware_type: string;
    tracking_id?: string;
    serial_number?: string;
    model?: string;
    assignment_date: string;
    renew_eligible_date?: string;
    notes?: string;
    is_active?: boolean;
}

export interface WorkerHardwareUpdate {
    hardware_type?: string;
    tracking_id?: string;
    serial_number?: string;
    model?: string;
    assignment_date?: string;
    renew_eligible_date?: string;
    notes?: string;
    is_active?: boolean;
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
}

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
    | 'created'
    | 'processing'
    | 'partial'
    | 'completed'
    | 'completed_with_failures'
    | 'cancelled';

export type NotificationStatus = 'created' | 'sent' | 'failed';

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
    created_at: string;
    updated_at: string;
}

export interface NotificationBatchCreate {
    name: string;
    channel?: NotificationBatchChannel;
    creator_account?: string;
    notifications?: NotificationCreate[];
}

export interface NotificationBatchUpdate {
    name?: string;
    channel?: NotificationBatchChannel;
    status?: 'processing' | 'cancelled';
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
    status?: NotificationStatus;
    scheduled_at?: string | null;
    error_message?: string | null;
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

export interface NotificationBatchTriggerResponse {
    notification_batch_oid: string;
    status: NotificationBatchStatus;
    to_process_count: number;
    run_id: string;
}

// ============================================================================
// Campaign Survey Batch Types
// ============================================================================

export type SurveyBatchStatus = 'created' | 'partial' | 'completed' | 'cancelled';

export type SurveyStatus = 'created' | 'submitted';

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
    created_at: string;
    updated_at: string;
}

export interface SurveyBatchCreate {
    name: string;
    creator_account?: string;
    surveys?: SurveyCreate[];
}

export interface SurveyBatchUpdate {
    name?: string;
    status?: 'cancelled';
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
    receiver_oid: string | null;
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
    survey_answer?: SurveyAnswerPayload | null;
    status?: SurveyStatus;
    submitted_at?: string | null;
}

export interface SurveyUpdate {
    receiver_oid?: string | null;
    survey_questions?: SurveyQuestions;
    survey_answer?: SurveyAnswerPayload | null;
    status?: SurveyStatus;
    submitted_at?: string | null;
}

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
