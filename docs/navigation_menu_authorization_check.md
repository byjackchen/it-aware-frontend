# Navigation Menu Authorization Check - Change Design Document

## 1. Overview

This document outlines the design for adding authorization checks to all navigation menu items in the IT Aware frontend application. The goal is to implement a robust permission-based access control system that leverages the existing user context and permission helpers.

## 2. Current Architecture Analysis

### 2.1 Existing Permission System
- **User Context** (`lib/contexts/user-context.tsx`): Provides permission checking functions via `useUser()` and `usePermissions()` hooks
- **Permission Helpers**: 
  - `hasPermission(permission: string)`: Check single permission
  - `hasAnyPermission(permissions: string[])`: Check if user has any of the specified permissions
  - `hasAllPermissions(permissions: string[])`: Check if user has all specified permissions
  - `hasRole(roleCode: string)`: Check role membership

### 2.2 Navigation Menu Structure
- **TopBar** (`components/layout/TopBar.tsx`): Main navigation with `navItems` array containing Security and Persona sections
- **Sidebar** (`components/layout/Sidebar.tsx`): Sub-navigation with `subMenuItems` object mapping main sections to sub-menu arrays

## 3. Implementation

### 3.1 Permission Constants (`lib/config/permissions.ts`)

Centralized permission constants following the `{domain}:{resource}:{action}` pattern:

```typescript
export const PERMISSIONS = {
  // Auth domain - top-level access control
  AUTH: {
    ALL_READ: 'auth:all:read',
    ALL_EDIT: 'auth:all:edit',
  },

  // Security domain
  SECURITY: {
    ALL_READ: 'security:all:read',
    ALL_EDIT: 'security:all:edit',
    OVERVIEW_READ: 'security:overview:read',
    OVERVIEW_EDIT: 'security:overview:edit',
    THREATS_READ: 'security:threats:read',
    THREATS_EDIT: 'security:threats:edit',
    ACCESS_READ: 'security:access:read',
    ACCESS_EDIT: 'security:access:edit',
    ACCESS_MANAGE: 'security:access:manage',
  },

  // Persona domain
  PERSONA: {
    ALL_READ: 'persona:all:read',
    ALL_EDIT: 'persona:all:edit',
    PROFILE_READ: 'persona:profile:read',
    PROFILE_EDIT: 'persona:profile:edit',
    TEAM_READ: 'persona:team:read',
    TEAM_EDIT: 'persona:team:edit',
    TEAM_MANAGE: 'persona:team:manage',
    SETTINGS_READ: 'persona:settings:read',
    SETTINGS_EDIT: 'persona:settings:edit',
  },
} as const;
```

### 3.2 Menu Types (`lib/types/menu.ts`)

Type definitions for menu items with permission configuration:

```typescript
export interface MenuPermissionConfig {
  requiredPermissions: string[];
  checkType?: 'any' | 'all'; // Default: 'any'
}

export interface MenuItem {
  href: string;
  label?: string;
  labelKey?: string;
  icon: LucideIcon;
  permissions?: MenuPermissionConfig;
}

// Helper functions for concise notation
export function requireAnyPermission(permissions: string[]): MenuPermissionConfig;
export function requireAllPermissions(permissions: string[]): MenuPermissionConfig;
```

### 3.3 Authorization Component (`components/layout/AuthorizedMenuItem.tsx`)

Reusable component and hook for permission-based rendering:

```typescript
// Component for wrapping menu items
export function AuthorizedMenuItem({ permissions, children, fallback }: AuthorizedMenuItemProps);

// Hook for filtering menu items
export function useMenuAuthorization(): {
  checkMenuAccess: (permissions?: MenuPermissionConfig) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
};
```

## 4. Permission Mapping

### 4.1 TopBar Navigation Permissions

| Menu Item | Required Permissions | Check Type | Description |
|-----------|---------------------|------------|-------------|
| Security | `auth:all:read`, `auth:all:edit` | any | Access to security module |
| Persona | `persona:all:read`, `persona:all:edit` | any | Access to persona management |

### 4.2 Security Sub-Menu Permissions

| Sub-Menu Item | Required Permissions | Check Type | Description |
|---------------|---------------------|------------|-------------|
| Overview | `security:overview:read`, `security:all:read` | any | View security overview |
| Threats | `security:threats:read`, `security:threats:edit`, `security:all:read` | any | Access threat management |
| Access | `security:access:read`, `security:access:edit`, `security:access:manage`, `security:all:read` | any | Access control management |

### 4.3 Persona Sub-Menu Permissions

| Sub-Menu Item | Required Permissions | Check Type | Description |
|---------------|---------------------|------------|-------------|
| Profile | `persona:profile:read`, `persona:profile:edit`, `persona:all:read` | any | Personal profile management |
| Team | `persona:team:read`, `persona:team:edit`, `persona:team:manage`, `persona:all:read` | any | Team management access |
| Settings | `persona:settings:read`, `persona:settings:edit`, `persona:all:read` | any | System settings access |

## 5. Usage Examples

### 5.1 TopBar Integration

```typescript
// In TopBar.tsx
const navItems: MenuItem[] = [
  { 
    href: '/security', 
    label: t('security'), 
    icon: Shield,
    permissions: requireAnyPermission([
      PERMISSIONS.NAVIGATION_SECURITY
    ]),
  },
];

// Filter based on permissions
const authorizedNavItems = navItems.filter(item => checkMenuAccess(item.permissions));
```

### 5.2 Sidebar Integration

```typescript
// In Sidebar.tsx
const subMenuItems: SubMenuConfig = {
  '/security': [
    { 
      href: '/security/overview', 
      labelKey: 'overview', 
      icon: ShieldCheck,
      permissions: requireAnyPermission([
        PERMISSIONS.SECURITY.OVERVIEW_READ,
        PERMISSIONS.SECURITY.ALL_READ,
      ]),
    },
    // ... more items
  ],
};

// Filter sub-menu items by permissions
const currentSubMenu = activeSection 
  ? subMenuItems[activeSection].filter(item => checkMenuAccess(item.permissions))
  : [];
```

### 5.3 Component Wrapper Usage

```typescript
// Alternative approach using AuthorizedMenuItem component
<AuthorizedMenuItem 
  permissions={requireAnyPermission(['auth:all:read', 'auth:all:edit'])}
>
  <Link href="/security">Security</Link>
</AuthorizedMenuItem>
```

## 6. Files Changed

| File | Type | Description |
|------|------|-------------|
| `lib/config/permissions.ts` | New | Permission constants |
| `lib/types/menu.ts` | New | Menu type definitions |
| `components/layout/AuthorizedMenuItem.tsx` | New | Authorization component and hook |
| `components/layout/TopBar.tsx` | Modified | Added permission checks to nav items |
| `components/layout/Sidebar.tsx` | Modified | Added permission checks to sub-menu items |

## 7. Testing Strategy

### 7.1 Unit Tests
- Test permission helper functions with various permission sets
- Verify `checkMenuAccess` returns correct boolean values
- Test edge cases (empty permissions, undefined permissions)

### 7.2 Integration Tests
- Verify menu rendering with different user permission sets
- Test that unauthorized items are filtered out
- Validate permission inheritance in nested menus

### 7.3 Manual Testing Scenarios
1. User with full permissions sees all menu items
2. User with read-only permissions sees appropriate menus
3. User with no permissions sees no navigation items
4. Permission changes reflect immediately in menu visibility

## 8. Security Considerations

- **Least Privilege**: Menu items require only necessary permissions
- **Fail-Safe**: Default to hidden if permissions are missing (no `permissions` config means always visible)
- **Client-Side Only**: This is UI-level authorization; server-side checks must still be enforced
- **Performance**: Uses React hooks with proper memoization to avoid unnecessary re-renders

## 9. Future Enhancements

- **Dynamic Permissions**: Support for runtime permission updates from server
- **Permission Groups**: Group-based permission management for easier configuration
- **UI Customization**: Different visual states for unauthorized items (disabled vs hidden)
- **Analytics**: Track permission usage and access patterns
- **Route Guards**: Implement route-level authorization to complement menu visibility

---

*Document Version: 1.1*  
*Last Updated: 2025-12-09*  
*Status: Implemented*