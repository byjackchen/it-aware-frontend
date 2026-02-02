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
    is_active: boolean;
    created_at: string;
    updated_at: string;
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
// Activity Types (Incidents & Inquiries)
// ============================================================================

export interface Incident {
    oid: string;
    incident_id: string;
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
    embedding_id: string | null;
    embedded_at: string | null;
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
    incident_id?: string | null;
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
    embedding_id?: string | null;
    embedded_at?: string | null;

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
    fact?: string | null;
    source_system?: string | null;
}


export interface IncidentUpdate {
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
    state?: string;
}

export interface InquiryUpdate {
    topic?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages?: any[] | null;
    fact?: string | null;
    source_system?: string | null;
    state?: string;
}
