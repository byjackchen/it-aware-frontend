/**
 * Security module type definitions for ABAC (Attribute-Based Access Control).
 */

// ============================================================================
// Core Entities
// ============================================================================

export interface Account {
  oid: string;
  username: string;
  is_active: boolean;
  account_type: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  oid: string;
  name: string;
  scope_type: 'unconstrained' | 'self_scoped' | 'role_based';
}

export interface Role {
  oid: string;
  name: string;
  include_desc: boolean;
}

export interface Permission {
  oid: string;
  domain: string;
  resource: string;
  action: string;
  permission_code: string; // Computed: {domain}:{resource}:{action}
}

// Worker is from objects domain, read-only on account page
export interface Worker {
  oid: string;
  worker_id: string | null;
  stable_id: string;
  fullname: string;
  email: string | null;
  org_oid: string;
  location_oid: string | null;
  manager_oid: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Input Types (for create/update operations)
// ============================================================================

export interface AccountCreate {
  username: string;
  is_active?: boolean;
  account_type?: string;
  password?: string; // Required for system accounts
}

export interface AccountUpdate {
  is_active?: boolean;
  password?: string;
}

export interface GroupCreate {
  name: string;
  scope_type: 'unconstrained' | 'self_scoped' | 'role_based';
}

export interface GroupUpdate {
  name?: string;
  scope_type?: 'unconstrained' | 'self_scoped' | 'role_based';
}

export interface RoleCreate {
  name: string;
  include_desc?: boolean;
}

export interface RoleUpdate {
  name?: string;
  include_desc?: boolean;
}

export interface PermissionCreate {
  domain: string;
  resource: string;
  action: string;
}

// ============================================================================
// Relationship Types
// ============================================================================

export interface AccountWorker {
  account_oid: string;
  worker_oid: string;
  linked_at: string;
}

export interface AccountGroup {
  account_oid: string;
  group_oid: string;
  assigned_at: string;
}

export interface GroupPermission {
  group_oid: string;
  permission_oid: string;
  assigned_at: string;
}

export interface GroupRole {
  group_oid: string;
  role_oid: string;
  linked_at: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  detail: string;
}

// ============================================================================
// Scope Type Options (for forms)
// ============================================================================

export const SCOPE_TYPES = [
  { value: 'unconstrained', label: 'Unconstrained' },
  { value: 'self_scoped', label: 'Self Scoped' },
  { value: 'role_based', label: 'Role Based' },
] as const;

export type ScopeType = 'unconstrained' | 'self_scoped' | 'role_based';
