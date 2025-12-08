/**
 * Server-side API client for Security module (RBAC configuration).
 * Uses cookies from next/headers for session authentication.
 */

import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type {
  Permission,
  Role,
  User,
  RolePermissionAssignment,
  UserRoleAssignment,
  CreatePermissionInput,
  UpdatePermissionInput,
  CreateRoleInput,
  UpdateRoleInput,
  CreateUserInput,
  UpdateUserInput,
} from '@/lib/types/security';

const BASE_URL = `${RUNTIME_CONFIG.backend.domain}/auth/config`;

// ============================================================================
// Core API Fetch Function
// ============================================================================

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
      ...options?.headers,
    },
    cache: 'no-store', // Disable caching for fresh data
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API Error: ${res.status}`);
  }

  // Handle 204 No Content responses
  if (res.status === 204) {
    return null as T;
  }

  return res.json();
}

// ============================================================================
// Permission APIs
// ============================================================================

export async function getPermissions(): Promise<Permission[]> {
  return fetchApi<Permission[]>('/permissions?limit=1000');
}

export async function getPermission(code: string): Promise<Permission> {
  return fetchApi<Permission>(`/permissions/${encodeURIComponent(code)}`);
}

export async function createPermission(data: CreatePermissionInput): Promise<Permission> {
  return fetchApi<Permission>('/permissions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePermission(code: string, data: UpdatePermissionInput): Promise<Permission> {
  return fetchApi<Permission>(`/permissions/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePermission(code: string): Promise<void> {
  return fetchApi<void>(`/permissions/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Role APIs
// ============================================================================

export async function getRoles(): Promise<Role[]> {
  return fetchApi<Role[]>('/roles?limit=1000');
}

export async function getRole(code: string): Promise<Role> {
  return fetchApi<Role>(`/roles/${encodeURIComponent(code)}`);
}

export async function createRole(data: CreateRoleInput): Promise<Role> {
  return fetchApi<Role>('/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRole(code: string, data: UpdateRoleInput): Promise<Role> {
  return fetchApi<Role>(`/roles/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(code: string): Promise<void> {
  return fetchApi<void>(`/roles/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// User APIs
// ============================================================================

export async function getUsers(isSystemUser?: boolean): Promise<User[]> {
  const params = new URLSearchParams({ limit: '1000' });
  if (isSystemUser !== undefined) {
    params.set('is_system_user', String(isSystemUser));
  }
  return fetchApi<User[]>(`/users?${params.toString()}`);
}

export async function getUser(username: string): Promise<User> {
  return fetchApi<User>(`/users/${encodeURIComponent(username)}`);
}

export async function createUser(data: CreateUserInput): Promise<User> {
  return fetchApi<User>('/users', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateUser(username: string, data: UpdateUserInput): Promise<User> {
  return fetchApi<User>(`/users/${encodeURIComponent(username)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteUser(username: string): Promise<void> {
  return fetchApi<void>(`/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Role-Permission Assignment APIs
// ============================================================================

export async function getRolePermissions(roleCode?: string): Promise<RolePermissionAssignment[]> {
  const params = new URLSearchParams({ limit: '1000' });
  if (roleCode) {
    params.set('role_code', roleCode);
  }
  return fetchApi<RolePermissionAssignment[]>(`/role-permissions?${params.toString()}`);
}

export async function assignPermissionToRole(
  roleCode: string,
  permissionCode: string
): Promise<RolePermissionAssignment> {
  return fetchApi<RolePermissionAssignment>('/role-permissions', {
    method: 'POST',
    body: JSON.stringify({ role_code: roleCode, permission_code: permissionCode }),
  });
}

export async function removePermissionFromRole(roleCode: string, permissionCode: string): Promise<void> {
  return fetchApi<void>(
    `/role-permissions/${encodeURIComponent(roleCode)}/${encodeURIComponent(permissionCode)}`,
    { method: 'DELETE' }
  );
}

// ============================================================================
// User-Role Assignment APIs
// ============================================================================

export async function getUserRoles(username?: string): Promise<UserRoleAssignment[]> {
  const params = new URLSearchParams({ limit: '1000' });
  if (username) {
    params.set('username', username);
  }
  return fetchApi<UserRoleAssignment[]>(`/user-roles?${params.toString()}`);
}

export async function assignRoleToUser(username: string, roleCode: string): Promise<UserRoleAssignment> {
  return fetchApi<UserRoleAssignment>('/user-roles', {
    method: 'POST',
    body: JSON.stringify({ username, role_code: roleCode }),
  });
}

export async function removeRoleFromUser(username: string, roleCode: string): Promise<void> {
  return fetchApi<void>(
    `/user-roles/${encodeURIComponent(username)}/${encodeURIComponent(roleCode)}`,
    { method: 'DELETE' }
  );
}
