/**
 * Type definitions for Objects module (organizations, locations, workers, tickets).
 * Also includes edges and registry types for Edge Relationships.
 */

// ============================================================================
// Hierarchy Types (shared base for Organizations and Locations)
// ============================================================================

export interface Hierarchy {
    oid: string;
    object_type: 'organization' | 'location';
    parent_oid: string | null;
    path: string[];
    created_at: string;
    updated_at: string;
}

// ============================================================================
// Organization Types
// ============================================================================

export interface Organization {
    oid: string;
    name: string;
    parent_oid: string | null;
    path: string[];
    created_at: string;
    updated_at: string;
}

export interface OrganizationCreate {
    name: string;
    parent_oid?: string | null;
}

export interface OrganizationUpdate {
    name?: string;
    parent_oid?: string | null;
}

// ============================================================================
// Location Types
// ============================================================================

export interface Location {
    oid: string;
    name: string;
    parent_oid: string | null;
    path: string[];
    created_at: string;
    updated_at: string;
}

export interface LocationCreate {
    name: string;
    parent_oid?: string | null;
}

export interface LocationUpdate {
    name?: string;
    parent_oid?: string | null;
}

// ============================================================================
// Worker Types
// ============================================================================

export interface Worker {
    oid: string;
    worker_id: string | null;
    full_name: string;
    email: string | null;
    org_oid: string;
    manager_oid: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface WorkerCreate {
    worker_id?: string | null;
    full_name: string;
    email?: string | null;
    org_oid: string;
    manager_oid?: string | null;
    is_active?: boolean;
}

export interface WorkerUpdate {
    worker_id?: string | null;
    full_name?: string;
    email?: string | null;
    org_oid?: string;
    manager_oid?: string | null;
    is_active?: boolean;
}

// ============================================================================
// Ticket Types
// ============================================================================

export interface Ticket {
    oid: string;
    org_oid: string;
    worker_oid: string;
    status: string;
    title: string;
    created_at: string;
}

export interface TicketCreate {
    org_oid: string;
    status?: string;
    title: string;
}

export interface TicketUpdate {
    status?: string;
    title?: string;
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
}
