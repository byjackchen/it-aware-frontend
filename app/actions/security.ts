'use server';

/**
 * Server Actions for Security module ABAC operations.
 * These actions handle form submissions and call the API client.
 */

import { revalidatePath } from 'next/cache';
import * as api from '@/lib/api/security';
import { logger } from '@/lib/logger';
import type {
  AccountCreate,
  AccountUpdate,
  GroupCreate,
  GroupUpdate,
  RoleCreate,
  RoleUpdate,
  PermissionCreate,
} from '@/lib/types/security';

// generateRequestId removed, using logger.generateRequestId()

// ============================================================================
// Permission Actions
// ============================================================================

export async function createPermission(formData: FormData) {
  const requestId = logger.generateRequestId();
  const action = 'Security:createPermission';
  const startTime = Date.now();

  const data: PermissionCreate = {
    domain: formData.get('domain') as string,
    resource: formData.get('resource') as string,
    action: formData.get('action') as string,
  };

  logger.info(`Started`, { requestId, action });

  try {
    const permission = await api.createPermission(data);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/permissions');
    return { success: true, permission };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to create permission' };
  }
}

export async function deletePermission(oid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:deletePermission';
  const startTime = Date.now();

  logger.info(`Started - oid: ${oid}`, { requestId, action });

  try {
    await api.deletePermission(oid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/permissions');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to delete permission' };
  }
}

// ============================================================================
// Role Actions
// ============================================================================

export async function createRole(formData: FormData) {
  const requestId = logger.generateRequestId();
  const action = 'Security:createRole';
  const startTime = Date.now();

  const data: RoleCreate = {
    name: formData.get('name') as string,
    include_desc: formData.get('include_desc') === 'true',
  };

  logger.info(`Started`, { requestId, action });

  try {
    const role = await api.createRole(data);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/roles');
    return { success: true, role };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to create role' };
  }
}

export async function updateRole(oid: string, formData: FormData) {
  const requestId = logger.generateRequestId();
  const action = 'Security:updateRole';
  const startTime = Date.now();

  const data: RoleUpdate = {
    name: formData.get('name') as string,
    include_desc: formData.get('include_desc') === 'true',
  };

  logger.info(`Started - oid: ${oid}`, { requestId, action });

  try {
    await api.updateRole(oid, data);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/roles');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to update role' };
  }
}

export async function deleteRole(oid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:deleteRole';
  const startTime = Date.now();

  logger.info(`Started - oid: ${oid}`, { requestId, action });

  try {
    await api.deleteRole(oid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/roles');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to delete role' };
  }
}

// ============================================================================
// Group Actions
// ============================================================================

export async function createGroup(formData: FormData) {
  const requestId = logger.generateRequestId();
  const action = 'Security:createGroup';
  const startTime = Date.now();

  const data: GroupCreate = {
    name: formData.get('name') as string,
    scope_type: formData.get('scope_type') as 'unconstrained' | 'self_scoped' | 'role_based',
  };

  logger.info(`Started`, { requestId, action });

  try {
    const group = await api.createGroup(data);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/groups');
    return { success: true, group };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to create group' };
  }
}

export async function updateGroup(oid: string, formData: FormData) {
  const requestId = logger.generateRequestId();
  const action = 'Security:updateGroup';
  const startTime = Date.now();

  const data: GroupUpdate = {
    name: formData.get('name') as string,
    scope_type: formData.get('scope_type') as 'unconstrained' | 'self_scoped' | 'role_based',
  };

  logger.info(`Started - oid: ${oid}`, { requestId, action });

  try {
    await api.updateGroup(oid, data);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to update group' };
  }
}

export async function deleteGroup(oid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:deleteGroup';
  const startTime = Date.now();

  logger.info(`Started - oid: ${oid}`, { requestId, action });

  try {
    await api.deleteGroup(oid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to delete group' };
  }
}

export async function assignGroupPermission(groupOid: string, permissionOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:assignGroupPermission';
  const startTime = Date.now();

  logger.info(`Started`, { requestId, action });

  try {
    await api.assignGroupPermission(groupOid, permissionOid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to assign permission' };
  }
}

export async function removeGroupPermission(groupOid: string, permissionOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:removeGroupPermission';
  const startTime = Date.now();

  logger.info(`Started`, { requestId, action });

  try {
    await api.removeGroupPermission(groupOid, permissionOid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to remove permission' };
  }
}

export async function linkGroupRole(groupOid: string, roleOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:linkGroupRole';
  const startTime = Date.now();

  logger.info(`Started`, { requestId, action });

  try {
    await api.linkGroupRole(groupOid, roleOid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to link role' };
  }
}

export async function unlinkGroupRole(groupOid: string, roleOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:unlinkGroupRole';
  const startTime = Date.now();

  logger.info(`Started`, { requestId, action });

  try {
    await api.unlinkGroupRole(groupOid, roleOid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/groups');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to unlink role' };
  }
}

// ============================================================================
// Account Actions
// ============================================================================

export async function createAccount(formData: FormData) {
  const requestId = logger.generateRequestId();
  const action = 'Security:createAccount';
  const startTime = Date.now();

  const accountType = formData.get('account_type') as string || 'user';
  const data: AccountCreate = {
    username: formData.get('username') as string,
    account_type: accountType,
    password: formData.get('password') as string || undefined,
  };

  logger.info(`Started`, { requestId, action });

  try {
    const account = await api.createAccount(data);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/accounts');
    return { success: true, account };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to create account' };
  }
}

export async function updateAccount(oid: string, formData: FormData) {
  const requestId = logger.generateRequestId();
  const action = 'Security:updateAccount';
  const startTime = Date.now();

  const data: AccountUpdate = {
    is_active: formData.get('is_active') === 'true',
  };

  const password = formData.get('password') as string;
  if (password) {
    data.password = password;
  }

  logger.info(`Started - oid: ${oid}`, { requestId, action });

  try {
    await api.updateAccount(oid, data);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to update account' };
  }
}

export async function deleteAccount(oid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:deleteAccount';
  const startTime = Date.now();

  logger.info(`Started - oid: ${oid}`, { requestId, action });

  try {
    await api.deleteAccount(oid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to delete account' };
  }
}

export async function linkAccountWorker(accountOid: string, workerOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:linkAccountWorker';
  const startTime = Date.now();

  logger.info(`Started`, { requestId, action });

  try {
    await api.linkAccountWorker(accountOid, workerOid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to link worker' };
  }
}

export async function unlinkAccountWorker(accountOid: string, workerOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:unlinkAccountWorker';
  const startTime = Date.now();

  logger.info(`Started`, { requestId, action });

  try {
    await api.unlinkAccountWorker(accountOid, workerOid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to unlink worker' };
  }
}

export async function linkAccountAgent(accountOid: string, agentOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:linkAccountAgent';
  logger.info('Started', { requestId, action });
  try {
    await api.linkAccountAgent(accountOid, agentOid);
    revalidatePath('/auth/accounts');
    revalidatePath(`/auth/accounts/${accountOid}`);
    logger.info('Success', { requestId, action });
    return { success: true };
  } catch (error) {
    logger.error('Failed', error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to link agent' };
  }
}

export async function unlinkAccountAgent(accountOid: string, agentOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:unlinkAccountAgent';
  logger.info('Started', { requestId, action });
  try {
    await api.unlinkAccountAgent(accountOid, agentOid);
    revalidatePath('/auth/accounts');
    revalidatePath(`/auth/accounts/${accountOid}`);
    logger.info('Success', { requestId, action });
    return { success: true };
  } catch (error) {
    logger.error('Failed', error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to unlink agent' };
  }
}

export async function linkAccountSystem(accountOid: string, systemOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:linkAccountSystem';
  logger.info('Started', { requestId, action });
  try {
    await api.linkAccountSystem(accountOid, systemOid);
    revalidatePath('/auth/accounts');
    revalidatePath(`/auth/accounts/${accountOid}`);
    logger.info('Success', { requestId, action });
    return { success: true };
  } catch (error) {
    logger.error('Failed', error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to link system' };
  }
}

export async function unlinkAccountSystem(accountOid: string, systemOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:unlinkAccountSystem';
  logger.info('Started', { requestId, action });
  try {
    await api.unlinkAccountSystem(accountOid, systemOid);
    revalidatePath('/auth/accounts');
    revalidatePath(`/auth/accounts/${accountOid}`);
    logger.info('Success', { requestId, action });
    return { success: true };
  } catch (error) {
    logger.error('Failed', error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to unlink system' };
  }
}

export async function assignAccountGroup(accountOid: string, groupOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:assignAccountGroup';
  const startTime = Date.now();

  logger.info(`Started`, { requestId, action });

  try {
    await api.assignAccountGroup(accountOid, groupOid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to assign group' };
  }
}

export async function removeAccountGroup(accountOid: string, groupOid: string) {
  const requestId = logger.generateRequestId();
  const action = 'Security:removeAccountGroup';
  const startTime = Date.now();

  logger.info(`Started`, { requestId, action });

  try {
    await api.removeAccountGroup(accountOid, groupOid);
    const duration = Date.now() - startTime;
    logger.info(`Success in ${duration}ms`, { requestId, action });
    revalidatePath('/auth/accounts');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed after ${duration}ms`, error, { requestId, action });
    return { error: error instanceof Error ? error.message : 'Failed to remove group' };
  }
}
