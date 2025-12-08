/**
 * Security module type definitions for RBAC management.
 */

// ============================================================================
// Core Entities
// ============================================================================

export interface Permission {
  permission_code: string; // e.g., "inventory:items:read"
  domain: string;
  resource: string;
  action: string;
  description: string;
}

export interface Role {
  role_code: string;
  name: string;
  description: string;
}

export interface User {
  username: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  is_system_user: boolean;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Assignment Entities
// ============================================================================

export interface RolePermissionAssignment {
  role_code: string;
  permission_code: string;
  granted_at: string;
  granted_by: string;
}

export interface UserRoleAssignment {
  username: string;
  role_code: string;
  assigned_at: string;
  assigned_by: string;
}

// ============================================================================
// Input Types (for create/update operations)
// ============================================================================

export interface CreatePermissionInput {
  domain: string;
  resource: string;
  action: string;
  description: string;
}

export interface UpdatePermissionInput {
  description: string;
}

export interface CreateRoleInput {
  role_code: string;
  name: string;
  description: string;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
}

export interface CreateUserInput {
  username: string;
  email?: string;
  full_name?: string;
  is_active?: boolean;
  is_system_user?: boolean;
  password?: string; // Required if is_system_user is true
}

export interface UpdateUserInput {
  email?: string;
  full_name?: string;
  is_active?: boolean;
  password?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  detail: string;
}
