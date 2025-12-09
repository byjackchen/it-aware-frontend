'use server';

/**
 * Server Actions for Security module CRUD operations.
 * These actions handle form submissions and call the API client.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as api from '@/lib/api/security';
import type {
  CreatePermissionInput,
  UpdatePermissionInput,
  CreateRoleInput,
  UpdateRoleInput,
  CreateUserInput,
  UpdateUserInput,
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
  
  const data: CreatePermissionInput = {
    domain: formData.get('domain') as string,
    resource: formData.get('resource') as string,
    action: formData.get('action') as string,
    description: formData.get('description') as string,
  };

  console.log(`[ServerAction:Security:createPermission:${requestId}] Started - domain: ${data.domain}, resource: ${data.resource}, action: ${data.action}`);

  let permission;
  try {
    permission = await api.createPermission(data);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:createPermission:${requestId}] Success in ${duration}ms - permission_code: ${permission.permission_code}`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:createPermission:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:createPermission:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to create permission' };
  }

  revalidatePath('/security/permissions');
  redirect(`/security/permissions?selected=${encodeURIComponent(permission.permission_code)}`);
}

export async function updatePermission(code: string, formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  const data: UpdatePermissionInput = {
    description: formData.get('description') as string,
  };

  console.log(`[ServerAction:Security:updatePermission:${requestId}] Started - code: ${code}`);

  try {
    await api.updatePermission(code, data);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:updatePermission:${requestId}] Success in ${duration}ms`);
    revalidatePath('/security/permissions');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:updatePermission:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:updatePermission:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to update permission' };
  }
}

export async function deletePermission(code: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[ServerAction:Security:deletePermission:${requestId}] Started - code: ${code}`);
  
  try {
    await api.deletePermission(code);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:deletePermission:${requestId}] Success in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:deletePermission:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:deletePermission:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to delete permission' };
  }

  revalidatePath('/security/permissions');
  redirect('/security/permissions');
}

// ============================================================================
// Role Actions
// ============================================================================

export async function createRole(formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  const data: CreateRoleInput = {
    role_code: formData.get('role_code') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string,
  };

  console.log(`[ServerAction:Security:createRole:${requestId}] Started - role_code: ${data.role_code}, name: ${data.name}`);

  let role;
  try {
    role = await api.createRole(data);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:createRole:${requestId}] Success in ${duration}ms - role_code: ${role.role_code}`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:createRole:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:createRole:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to create role' };
  }

  revalidatePath('/security/roles');
  redirect(`/security/roles?selected=${encodeURIComponent(role.role_code)}`);
}

export async function updateRole(code: string, formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  const data: UpdateRoleInput = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
  };

  console.log(`[ServerAction:Security:updateRole:${requestId}] Started - code: ${code}, name: ${data.name}`);

  try {
    await api.updateRole(code, data);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:updateRole:${requestId}] Success in ${duration}ms`);
    revalidatePath('/security/roles');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:updateRole:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:updateRole:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to update role' };
  }
}

export async function deleteRole(code: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[ServerAction:Security:deleteRole:${requestId}] Started - code: ${code}`);
  
  try {
    await api.deleteRole(code);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:deleteRole:${requestId}] Success in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:deleteRole:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:deleteRole:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to delete role' };
  }

  revalidatePath('/security/roles');
  redirect('/security/roles');
}

// ============================================================================
// User Actions
// ============================================================================

export async function createUser(formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  const isSystemUser = formData.get('is_system_user') === 'true';
  const data: CreateUserInput = {
    username: formData.get('username') as string,
    email: (formData.get('email') as string) || undefined,
    full_name: (formData.get('full_name') as string) || undefined,
    is_active: formData.get('is_active') !== 'false',
    is_system_user: isSystemUser,
    password: isSystemUser ? (formData.get('password') as string) : undefined,
  };

  console.log(`[ServerAction:Security:createUser:${requestId}] Started - username: ${data.username}, isSystemUser: ${isSystemUser}`);

  let user;
  try {
    user = await api.createUser(data);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:createUser:${requestId}] Success in ${duration}ms - username: ${user.username}`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:createUser:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:createUser:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to create user' };
  }

  revalidatePath('/security/users');
  redirect(`/security/users?selected=${encodeURIComponent(user.username)}`);
}

export async function updateUser(username: string, formData: FormData) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  const data: UpdateUserInput = {
    email: (formData.get('email') as string) || undefined,
    full_name: (formData.get('full_name') as string) || undefined,
    is_active: formData.get('is_active') !== 'false',
  };

  // Only include password if provided
  const password = formData.get('password') as string;
  if (password) {
    data.password = password;
  }

  console.log(`[ServerAction:Security:updateUser:${requestId}] Started - username: ${username}, hasPassword: ${!!password}`);

  try {
    await api.updateUser(username, data);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:updateUser:${requestId}] Success in ${duration}ms`);
    revalidatePath('/security/users');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:updateUser:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:updateUser:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to update user' };
  }
}

export async function deleteUser(username: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[ServerAction:Security:deleteUser:${requestId}] Started - username: ${username}`);
  
  try {
    await api.deleteUser(username);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:deleteUser:${requestId}] Success in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:deleteUser:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:deleteUser:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to delete user' };
  }

  revalidatePath('/security/users');
  redirect('/security/users');
}

// ============================================================================
// Role-Permission Assignment Actions
// ============================================================================

export async function assignPermissionToRole(roleCode: string, permissionCode: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[ServerAction:Security:assignPermissionToRole:${requestId}] Started - roleCode: ${roleCode}, permissionCode: ${permissionCode}`);
  
  try {
    await api.assignPermissionToRole(roleCode, permissionCode);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:assignPermissionToRole:${requestId}] Success in ${duration}ms`);
    revalidatePath('/security/roles');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:assignPermissionToRole:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:assignPermissionToRole:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to assign permission' };
  }
}

export async function removePermissionFromRole(roleCode: string, permissionCode: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[ServerAction:Security:removePermissionFromRole:${requestId}] Started - roleCode: ${roleCode}, permissionCode: ${permissionCode}`);
  
  try {
    await api.removePermissionFromRole(roleCode, permissionCode);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:removePermissionFromRole:${requestId}] Success in ${duration}ms`);
    revalidatePath('/security/roles');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:removePermissionFromRole:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:removePermissionFromRole:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to remove permission' };
  }
}

// ============================================================================
// User-Role Assignment Actions
// ============================================================================

export async function assignRoleToUser(username: string, roleCode: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[ServerAction:Security:assignRoleToUser:${requestId}] Started - username: ${username}, roleCode: ${roleCode}`);
  
  try {
    await api.assignRoleToUser(username, roleCode);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:assignRoleToUser:${requestId}] Success in ${duration}ms`);
    revalidatePath('/security/users');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:assignRoleToUser:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:assignRoleToUser:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to assign role' };
  }
}

export async function removeRoleFromUser(username: string, roleCode: string) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[ServerAction:Security:removeRoleFromUser:${requestId}] Started - username: ${username}, roleCode: ${roleCode}`);
  
  try {
    await api.removeRoleFromUser(username, roleCode);
    const duration = Date.now() - startTime;
    console.log(`[ServerAction:Security:removeRoleFromUser:${requestId}] Success in ${duration}ms`);
    revalidatePath('/security/users');
    return { success: true };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[ServerAction:Security:removeRoleFromUser:${requestId}] Failed after ${duration}ms:`, error);
    console.error(`[ServerAction:Security:removeRoleFromUser:${requestId}] Error message:`, error instanceof Error ? error.message : String(error));
    return { error: error instanceof Error ? error.message : 'Failed to remove role' };
  }
}
