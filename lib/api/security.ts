/**
 * Server-side API client for Security module (ABAC configuration).
 * Uses cookies from next/headers for session authentication.
 */

// cookies removed as they are now used in core.ts
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type {
  Account,
  AccountCreate,
  AccountUpdate,
  Group,
  GroupCreate,
  GroupUpdate,
  Role,
  RoleCreate,
  RoleUpdate,
  Permission,
  PermissionCreate,
  Worker,
  AccountWorker,
  AccountGroup,
  GroupPermission,
  GroupRole,
} from '@/lib/types/security';

const AUTH_CONFIG_BASE = `${RUNTIME_CONFIG.backend.domain}/auth/config`;
const OBJECTS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects`;

// ============================================================================
// Core API Fetch Function
// ============================================================================

import { fetchApi } from '@/lib/api/core';

// ============================================================================
// Core API Fetch Function
// ============================================================================

// fetchApi moved to @/lib/api/core.ts

// ============================================================================
// Account APIs
// ============================================================================

export async function getAccounts(isSystem?: boolean): Promise<Account[]> {
  const params = new URLSearchParams({ limit: '1000' });
  if (isSystem !== undefined) {
    params.set('is_system', String(isSystem));
  }
  return fetchApi<Account[]>(`${AUTH_CONFIG_BASE}/accounts?${params.toString()}`);
}

export async function getAccount(oid: string): Promise<Account> {
  return fetchApi<Account>(`${AUTH_CONFIG_BASE}/accounts/${encodeURIComponent(oid)}`);
}

export async function createAccount(data: AccountCreate): Promise<Account> {
  return fetchApi<Account>(`${AUTH_CONFIG_BASE}/accounts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateAccount(oid: string, data: AccountUpdate): Promise<Account> {
  return fetchApi<Account>(`${AUTH_CONFIG_BASE}/accounts/${encodeURIComponent(oid)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteAccount(oid: string): Promise<void> {
  return fetchApi<void>(`${AUTH_CONFIG_BASE}/accounts/${encodeURIComponent(oid)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Group APIs
// ============================================================================

export async function getGroups(): Promise<Group[]> {
  return fetchApi<Group[]>(`${AUTH_CONFIG_BASE}/groups?limit=1000`);
}

export async function getGroup(oid: string): Promise<Group> {
  return fetchApi<Group>(`${AUTH_CONFIG_BASE}/groups/${encodeURIComponent(oid)}`);
}

export async function createGroup(data: GroupCreate): Promise<Group> {
  return fetchApi<Group>(`${AUTH_CONFIG_BASE}/groups`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateGroup(oid: string, data: GroupUpdate): Promise<Group> {
  return fetchApi<Group>(`${AUTH_CONFIG_BASE}/groups/${encodeURIComponent(oid)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteGroup(oid: string): Promise<void> {
  return fetchApi<void>(`${AUTH_CONFIG_BASE}/groups/${encodeURIComponent(oid)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Role APIs
// ============================================================================

export async function getRoles(): Promise<Role[]> {
  return fetchApi<Role[]>(`${AUTH_CONFIG_BASE}/roles?limit=1000`);
}

export async function getRole(oid: string): Promise<Role> {
  return fetchApi<Role>(`${AUTH_CONFIG_BASE}/roles/${encodeURIComponent(oid)}`);
}

export async function createRole(data: RoleCreate): Promise<Role> {
  return fetchApi<Role>(`${AUTH_CONFIG_BASE}/roles`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateRole(oid: string, data: RoleUpdate): Promise<Role> {
  return fetchApi<Role>(`${AUTH_CONFIG_BASE}/roles/${encodeURIComponent(oid)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteRole(oid: string): Promise<void> {
  return fetchApi<void>(`${AUTH_CONFIG_BASE}/roles/${encodeURIComponent(oid)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Permission APIs
// ============================================================================

export async function getPermissions(): Promise<Permission[]> {
  return fetchApi<Permission[]>(`${AUTH_CONFIG_BASE}/permissions?limit=1000`);
}

export async function getPermission(oid: string): Promise<Permission> {
  return fetchApi<Permission>(`${AUTH_CONFIG_BASE}/permissions/${encodeURIComponent(oid)}`);
}

export async function createPermission(data: PermissionCreate): Promise<Permission> {
  return fetchApi<Permission>(`${AUTH_CONFIG_BASE}/permissions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deletePermission(oid: string): Promise<void> {
  return fetchApi<void>(`${AUTH_CONFIG_BASE}/permissions/${encodeURIComponent(oid)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Account-Worker Link APIs
// ============================================================================

export async function getAccountWorkers(accountOid?: string): Promise<AccountWorker[]> {
  const params = new URLSearchParams({ limit: '1000' });
  if (accountOid) {
    params.set('account_oid', accountOid);
  }
  return fetchApi<AccountWorker[]>(`${AUTH_CONFIG_BASE}/account_workers?${params.toString()}`);
}

export async function linkAccountWorker(accountOid: string, workerOid: string): Promise<AccountWorker> {
  return fetchApi<AccountWorker>(`${AUTH_CONFIG_BASE}/account_workers`, {
    method: 'POST',
    body: JSON.stringify({ account_oid: accountOid, worker_oid: workerOid }),
  });
}

export async function unlinkAccountWorker(accountOid: string): Promise<void> {
  return fetchApi<void>(`${AUTH_CONFIG_BASE}/account_workers/${encodeURIComponent(accountOid)}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Account-Group Assignment APIs
// ============================================================================

export async function getAccountGroups(accountOid?: string): Promise<AccountGroup[]> {
  const params = new URLSearchParams({ limit: '1000' });
  if (accountOid) {
    params.set('account_oid', accountOid);
  }
  return fetchApi<AccountGroup[]>(`${AUTH_CONFIG_BASE}/account_groups?${params.toString()}`);
}

export async function assignAccountGroup(accountOid: string, groupOid: string): Promise<AccountGroup> {
  return fetchApi<AccountGroup>(`${AUTH_CONFIG_BASE}/account_groups`, {
    method: 'POST',
    body: JSON.stringify({ account_oid: accountOid, group_oid: groupOid }),
  });
}

export async function removeAccountGroup(accountOid: string, groupOid: string): Promise<void> {
  return fetchApi<void>(
    `${AUTH_CONFIG_BASE}/account_groups/${encodeURIComponent(accountOid)}/${encodeURIComponent(groupOid)}`,
    { method: 'DELETE' }
  );
}

// ============================================================================
// Group-Permission Assignment APIs
// ============================================================================

export async function getGroupPermissions(groupOid?: string): Promise<GroupPermission[]> {
  const params = new URLSearchParams({ limit: '1000' });
  if (groupOid) {
    params.set('group_oid', groupOid);
  }
  return fetchApi<GroupPermission[]>(`${AUTH_CONFIG_BASE}/group_permissions?${params.toString()}`);
}

export async function assignGroupPermission(groupOid: string, permissionOid: string): Promise<GroupPermission> {
  return fetchApi<GroupPermission>(`${AUTH_CONFIG_BASE}/group_permissions`, {
    method: 'POST',
    body: JSON.stringify({ group_oid: groupOid, permission_oid: permissionOid }),
  });
}

export async function removeGroupPermission(groupOid: string, permissionOid: string): Promise<void> {
  return fetchApi<void>(
    `${AUTH_CONFIG_BASE}/group_permissions/${encodeURIComponent(groupOid)}/${encodeURIComponent(permissionOid)}`,
    { method: 'DELETE' }
  );
}

// ============================================================================
// Group-Role Link APIs
// ============================================================================

export async function getGroupRoles(groupOid?: string): Promise<GroupRole[]> {
  const params = new URLSearchParams({ limit: '1000' });
  if (groupOid) {
    params.set('group_oid', groupOid);
  }
  return fetchApi<GroupRole[]>(`${AUTH_CONFIG_BASE}/group_roles?${params.toString()}`);
}

export async function linkGroupRole(groupOid: string, roleOid: string): Promise<GroupRole> {
  return fetchApi<GroupRole>(`${AUTH_CONFIG_BASE}/group_roles`, {
    method: 'POST',
    body: JSON.stringify({ group_oid: groupOid, role_oid: roleOid }),
  });
}

export async function unlinkGroupRole(groupOid: string, roleOid: string): Promise<void> {
  return fetchApi<void>(
    `${AUTH_CONFIG_BASE}/group_roles/${encodeURIComponent(groupOid)}/${encodeURIComponent(roleOid)}`,
    { method: 'DELETE' }
  );
}

// ============================================================================
// Worker APIs (Read-Only, from Objects domain)
// ============================================================================

export async function getWorkers(isActive?: boolean): Promise<Worker[]> {
  const params = new URLSearchParams({ limit: '1000' });
  if (isActive !== undefined) {
    params.set('is_active', String(isActive));
  }
  return fetchApi<Worker[]>(`${OBJECTS_BASE}/workers?${params.toString()}`);
}

export async function getWorker(oid: string): Promise<Worker> {
  return fetchApi<Worker>(`${OBJECTS_BASE}/workers/${encodeURIComponent(oid)}`);
}
