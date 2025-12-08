'use client';

import React from 'react';
import { usePermissions } from '@/lib/contexts/user-context';
import type { MenuPermissionConfig } from '@/lib/types/menu';

interface AuthorizedMenuItemProps {
  /** Permission configuration for the menu item */
  permissions?: MenuPermissionConfig;
  /** Content to render if user has required permissions */
  children: React.ReactNode;
  /** Optional fallback content when user lacks permissions (defaults to null) */
  fallback?: React.ReactNode;
}

/**
 * A wrapper component that conditionally renders menu items based on user permissions.
 * 
 * @example
 * // Menu item visible if user has either 'auth:all:read' OR 'auth:all:edit'
 * <AuthorizedMenuItem permissions={{ requiredPermissions: ['auth:all:read', 'auth:all:edit'], checkType: 'any' }}>
 *   <Link href="/security">Security</Link>
 * </AuthorizedMenuItem>
 * 
 * @example
 * // Menu item always visible (no permissions defined)
 * <AuthorizedMenuItem>
 *   <Link href="/home">Home</Link>
 * </AuthorizedMenuItem>
 */
export function AuthorizedMenuItem({ 
  permissions, 
  children, 
  fallback = null 
}: AuthorizedMenuItemProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  // If no permissions are defined, always render the children
  if (!permissions || permissions.requiredPermissions.length === 0) {
    return <>{children}</>;
  }

  const { requiredPermissions, checkType = 'any' } = permissions;

  // Evaluate permissions based on check type
  const hasAccess = checkType === 'all'
    ? hasAllPermissions(requiredPermissions)
    : hasAnyPermission(requiredPermissions);

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Hook to check if a menu item should be visible based on permissions.
 * Useful when you need to filter menu items before rendering.
 * 
 * @example
 * const { checkMenuAccess } = useMenuAuthorization();
 * const visibleItems = menuItems.filter(item => checkMenuAccess(item.permissions));
 */
export function useMenuAuthorization() {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  const checkMenuAccess = (permissions?: MenuPermissionConfig): boolean => {
    if (!permissions || permissions.requiredPermissions.length === 0) {
      return true;
    }

    const { requiredPermissions, checkType = 'any' } = permissions;

    return checkType === 'all'
      ? hasAllPermissions(requiredPermissions)
      : hasAnyPermission(requiredPermissions);
  };

  return { checkMenuAccess, hasPermission, hasAnyPermission, hasAllPermissions };
}
