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

// ============================================================================
// Permission Actions
// ============================================================================

export async function createPermission(formData: FormData) {
  const data: CreatePermissionInput = {
    domain: formData.get('domain') as string,
    resource: formData.get('resource') as string,
    action: formData.get('action') as string,
    description: formData.get('description') as string,
  };

  let permission;
  try {
    permission = await api.createPermission(data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create permission' };
  }

  revalidatePath('/security/permissions');
  redirect(`/security/permissions?selected=${encodeURIComponent(permission.permission_code)}`);
}

export async function updatePermission(code: string, formData: FormData) {
  const data: UpdatePermissionInput = {
    description: formData.get('description') as string,
  };

  try {
    await api.updatePermission(code, data);
    revalidatePath('/security/permissions');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update permission' };
  }
}

export async function deletePermission(code: string) {
  try {
    await api.deletePermission(code);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to delete permission' };
  }

  revalidatePath('/security/permissions');
  redirect('/security/permissions');
}

// ============================================================================
// Role Actions
// ============================================================================

export async function createRole(formData: FormData) {
  const data: CreateRoleInput = {
    role_code: formData.get('role_code') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string,
  };

  let role;
  try {
    role = await api.createRole(data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create role' };
  }

  revalidatePath('/security/roles');
  redirect(`/security/roles?selected=${encodeURIComponent(role.role_code)}`);
}

export async function updateRole(code: string, formData: FormData) {
  const data: UpdateRoleInput = {
    name: formData.get('name') as string,
    description: formData.get('description') as string,
  };

  try {
    await api.updateRole(code, data);
    revalidatePath('/security/roles');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update role' };
  }
}

export async function deleteRole(code: string) {
  try {
    await api.deleteRole(code);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to delete role' };
  }

  revalidatePath('/security/roles');
  redirect('/security/roles');
}

// ============================================================================
// User Actions
// ============================================================================

export async function createUser(formData: FormData) {
  const isSystemUser = formData.get('is_system_user') === 'true';
  const data: CreateUserInput = {
    username: formData.get('username') as string,
    email: (formData.get('email') as string) || undefined,
    full_name: (formData.get('full_name') as string) || undefined,
    is_active: formData.get('is_active') !== 'false',
    is_system_user: isSystemUser,
    password: isSystemUser ? (formData.get('password') as string) : undefined,
  };

  let user;
  try {
    user = await api.createUser(data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to create user' };
  }

  revalidatePath('/security/users');
  redirect(`/security/users?selected=${encodeURIComponent(user.username)}`);
}

export async function updateUser(username: string, formData: FormData) {
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

  try {
    await api.updateUser(username, data);
    revalidatePath('/security/users');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to update user' };
  }
}

export async function deleteUser(username: string) {
  try {
    await api.deleteUser(username);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to delete user' };
  }

  revalidatePath('/security/users');
  redirect('/security/users');
}

// ============================================================================
// Role-Permission Assignment Actions
// ============================================================================

export async function assignPermissionToRole(roleCode: string, permissionCode: string) {
  try {
    await api.assignPermissionToRole(roleCode, permissionCode);
    revalidatePath('/security/roles');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to assign permission' };
  }
}

export async function removePermissionFromRole(roleCode: string, permissionCode: string) {
  try {
    await api.removePermissionFromRole(roleCode, permissionCode);
    revalidatePath('/security/roles');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to remove permission' };
  }
}

// ============================================================================
// User-Role Assignment Actions
// ============================================================================

export async function assignRoleToUser(username: string, roleCode: string) {
  try {
    await api.assignRoleToUser(username, roleCode);
    revalidatePath('/security/users');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to assign role' };
  }
}

export async function removeRoleFromUser(username: string, roleCode: string) {
  try {
    await api.removeRoleFromUser(username, roleCode);
    revalidatePath('/security/users');
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Failed to remove role' };
  }
}
