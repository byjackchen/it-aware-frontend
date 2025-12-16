'use server';

/**
 * Server Actions for Security module ABAC operations.
 * These actions handle form submissions and call the API client.
 */

import { revalidatePath } from 'next/cache';
import * as api from '@/lib/api/security';
import type {
  AccountCreate,
  AccountUpdate,
  GroupCreate,
  GroupUpdate,
  RoleCreate,
  RoleUpdate,
  PermissionCreate,
} from '@/lib/types/security';

// Generate a short request ID for log correlation
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10);
}

// ============================================================================
// Permission Actions
// ============================================================================

export async function createPermission(formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const data: PermissionCreate = {
    domain: formData.get('domain') as string,
    resource: formData.get('resource') as string,
    action: formData.get('action') as string,
  };

  console.log(`[Action:Security:createPermission:${requestId}] Started`);

  try {
    const permission = await api.createPermission(data);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:createPermission:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/permissions');
    return { success: true, permission };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:createPermission:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to create permission' };
  }
}

export async function deletePermission(oid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:deletePermission:${requestId}] Started - oid: ${oid}`);

  try {
    await api.deletePermission(oid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:deletePermission:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/permissions');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:deletePermission:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to delete permission' };
  }
}

// ============================================================================
// Role Actions
// ============================================================================

export async function createRole(formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const data: RoleCreate = {
    name: formData.get('name') as string,
    include_desc: formData.get('include_desc') === 'true',
  };

  console.log(`[Action:Security:createRole:${requestId}] Started`);

  try {
    const role = await api.createRole(data);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:createRole:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/roles');
    return { success: true, role };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:createRole:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to create role' };
  }
}

export async function updateRole(oid: string, formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const data: RoleUpdate = {
    name: formData.get('name') as string,
    include_desc: formData.get('include_desc') === 'true',
  };

  console.log(`[Action:Security:updateRole:${requestId}] Started - oid: ${oid}`);

  try {
    await api.updateRole(oid, data);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:updateRole:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/roles');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:updateRole:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to update role' };
  }
}

export async function deleteRole(oid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:deleteRole:${requestId}] Started - oid: ${oid}`);

  try {
    await api.deleteRole(oid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:deleteRole:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/roles');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:deleteRole:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to delete role' };
  }
}

// ============================================================================
// Group Actions
// ============================================================================

export async function createGroup(formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const data: GroupCreate = {
    name: formData.get('name') as string,
    scope_type: formData.get('scope_type') as 'unconstrained' | 'self_scoped' | 'role_based',
  };

  console.log(`[Action:Security:createGroup:${requestId}] Started`);

  try {
    const group = await api.createGroup(data);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:createGroup:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/groups');
    return { success: true, group };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:createGroup:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to create group' };
  }
}

export async function updateGroup(oid: string, formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const data: GroupUpdate = {
    name: formData.get('name') as string,
    scope_type: formData.get('scope_type') as 'unconstrained' | 'self_scoped' | 'role_based',
  };

  console.log(`[Action:Security:updateGroup:${requestId}] Started - oid: ${oid}`);

  try {
    await api.updateGroup(oid, data);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:updateGroup:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:updateGroup:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to update group' };
  }
}

export async function deleteGroup(oid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:deleteGroup:${requestId}] Started - oid: ${oid}`);

  try {
    await api.deleteGroup(oid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:deleteGroup:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:deleteGroup:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to delete group' };
  }
}

export async function assignGroupPermission(groupOid: string, permissionOid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:assignGroupPermission:${requestId}] Started`);

  try {
    await api.assignGroupPermission(groupOid, permissionOid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:assignGroupPermission:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:assignGroupPermission:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to assign permission' };
  }
}

export async function removeGroupPermission(groupOid: string, permissionOid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:removeGroupPermission:${requestId}] Started`);

  try {
    await api.removeGroupPermission(groupOid, permissionOid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:removeGroupPermission:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:removeGroupPermission:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to remove permission' };
  }
}

export async function linkGroupRole(groupOid: string, roleOid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:linkGroupRole:${requestId}] Started`);

  try {
    await api.linkGroupRole(groupOid, roleOid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:linkGroupRole:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:linkGroupRole:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to link role' };
  }
}

export async function unlinkGroupRole(groupOid: string, roleOid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:unlinkGroupRole:${requestId}] Started`);

  try {
    await api.unlinkGroupRole(groupOid, roleOid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:unlinkGroupRole:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:unlinkGroupRole:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to unlink role' };
  }
}

// ============================================================================
// Account Actions
// ============================================================================

export async function createAccount(formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const isSystem = formData.get('is_system') === 'true';
  const data: AccountCreate = {
    username: formData.get('username') as string,
    is_system: isSystem,
    password: isSystem ? (formData.get('password') as string) : undefined,
  };

  console.log(`[Action:Security:createAccount:${requestId}] Started`);

  try {
    const account = await api.createAccount(data);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:createAccount:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/accounts');
    return { success: true, account };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:createAccount:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to create account' };
  }
}

export async function updateAccount(oid: string, formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const data: AccountUpdate = {
    is_active: formData.get('is_active') === 'true',
  };

  const password = formData.get('password') as string;
  if (password) {
    data.password = password;
  }

  console.log(`[Action:Security:updateAccount:${requestId}] Started - oid: ${oid}`);

  try {
    await api.updateAccount(oid, data);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:updateAccount:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:updateAccount:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to update account' };
  }
}

export async function deleteAccount(oid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:deleteAccount:${requestId}] Started - oid: ${oid}`);

  try {
    await api.deleteAccount(oid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:deleteAccount:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:deleteAccount:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to delete account' };
  }
}

export async function linkAccountWorker(accountOid: string, workerOid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:linkAccountWorker:${requestId}] Started`);

  try {
    await api.linkAccountWorker(accountOid, workerOid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:linkAccountWorker:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:linkAccountWorker:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to link worker' };
  }
}

export async function unlinkAccountWorker(accountOid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:unlinkAccountWorker:${requestId}] Started`);

  try {
    await api.unlinkAccountWorker(accountOid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:unlinkAccountWorker:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:unlinkAccountWorker:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to unlink worker' };
  }
}

export async function assignAccountGroup(accountOid: string, groupOid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:assignAccountGroup:${requestId}] Started`);

  try {
    await api.assignAccountGroup(accountOid, groupOid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:assignAccountGroup:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:assignAccountGroup:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to assign group' };
  }
}

export async function removeAccountGroup(accountOid: string, groupOid: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();

  console.log(`[Action:Security:removeAccountGroup:${requestId}] Started`);

  try {
    await api.removeAccountGroup(accountOid, groupOid);
    const duration = Date.now() - startTime;
    console.log(`[Action:Security:removeAccountGroup:${requestId}] Success in ${duration}ms`);
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Action:Security:removeAccountGroup:${requestId}] Failed after ${duration}ms:`, error);
    return { error: error instanceof Error ? error.message : 'Failed to remove group' };
  }
}
