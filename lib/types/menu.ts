import { type LucideIcon } from 'lucide-react';

/**
 * Permission check configuration for menu items.
 * Defines which permissions are required and how to evaluate them.
 */
export interface MenuPermissionConfig {
  /** List of permission strings required for this menu item */
  requiredPermissions: string[];
  /** 
   * How to evaluate permissions:
   * - 'any': User needs at least one of the permissions (default)
   * - 'all': User needs all of the permissions
   */
  checkType?: 'any' | 'all';
}

/**
 * Base menu item interface with optional permission configuration.
 */
export interface MenuItem {
  /** Route path for the menu item */
  href: string;
  /** Display label (can be a translation key or direct text) */
  label?: string;
  /** Translation key for internationalization */
  labelKey?: string;
  /** Icon component to display */
  icon: LucideIcon;
  /** Permission configuration - if undefined, menu is always visible */
  permissions?: MenuPermissionConfig;
}

/**
 * Sub-menu items configuration mapping main sections to their sub-menus.
 */
export type SubMenuConfig = Record<string, MenuItem[]>;

/**
 * Helper function to create a permission config with 'any' check type.
 * This is a shorthand for common permission patterns.
 * 
 * @example
 * requireAnyPermission(['auth:all:read', 'auth:all:edit'])
 */
export function requireAnyPermission(permissions: string[]): MenuPermissionConfig {
  return {
    requiredPermissions: permissions,
    checkType: 'any',
  };
}

/**
 * Helper function to create a permission config with 'all' check type.
 * 
 * @example
 * requireAllPermissions(['security:threats:read', 'security:threats:edit'])
 */
export function requireAllPermissions(permissions: string[]): MenuPermissionConfig {
  return {
    requiredPermissions: permissions,
    checkType: 'all',
  };
}
