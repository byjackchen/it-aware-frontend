# Security UI Development Plan

## 1. Overview

Build an RBAC management UI with three pages: **Users**, **Roles**, **Permissions**. Each page uses a Master/Detail layout. Users and Roles pages include assignment management at the bottom of the detail pane.

## 2. Architecture

**Server Components by default.** Pages fetch data server-side, pass to child components. Mutations use Server Actions with `revalidatePath()`.

| Layer | Rendering | Responsibility |
|-------|-----------|----------------|
| `page.tsx` | Server | Fetch data, render layout |
| List/Detail components | Server | Display data, render forms |
| Interactive elements | Client (`'use client'`) | Only for: click handlers, form submissions, state (selected item) |

**URL-based selection**: Selected item passed via `?selected=<id>` search param, avoiding client state.

## 3. File Structure

```
app/(main)/security/
├── users/page.tsx           # Server Component - fetches users, roles
├── roles/page.tsx           # Server Component - fetches roles, permissions
├── permissions/page.tsx     # Server Component - fetches permissions
└── actions.ts               # Server Actions for mutations

components/security/
├── MasterDetailLayout.tsx   # Server Component - split-pane container
├── EntityList.tsx           # Client Component - list with selection
├── EntityForm.tsx           # Client Component - create/edit form
├── AssignmentManager.tsx    # Client Component - assignment UI
└── DeleteButton.tsx         # Client Component - delete with confirmation

lib/
├── api/security.ts          # Server-side API client (uses cookies())
└── types/security.ts        # TypeScript interfaces
```

## 4. Data Models

**File:** `lib/types/security.ts`

```typescript
export interface Permission {
    permission_code: string;  // e.g., "inventory:items:read"
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
```

## 5. Backend API Specification

**Base URL:** `{RUNTIME_CONFIG.backend.domain}/auth/config`  
**Auth:** Session cookies (auto-attached by browser, use `credentials: 'include'`)

### 5.1 Endpoints

| Resource | Method | Endpoint | Request Body | Response |
|----------|--------|----------|--------------|----------|
| **Permissions** |
| List | GET | `/permissions?skip=0&limit=100` | - | `Permission[]` |
| Get | GET | `/permissions/{code}` | - | `Permission` |
| Create | POST | `/permissions` | `{domain, resource, action, description}` | `Permission` (201) |
| Update | PUT | `/permissions/{code}` | `{description}` | `Permission` |
| Delete | DELETE | `/permissions/{code}` | - | 204 |
| **Roles** |
| List | GET | `/roles?skip=0&limit=100` | - | `Role[]` |
| Get | GET | `/roles/{code}` | - | `Role` |
| Create | POST | `/roles` | `{role_code, name, description}` | `Role` (201) |
| Update | PUT | `/roles/{code}` | `{name?, description?}` | `Role` |
| Delete | DELETE | `/roles/{code}` | - | 204 |
| **Users** |
| List | GET | `/users?skip=0&limit=100&is_system_user=bool` | - | `User[]` |
| Get | GET | `/users/{username}` | - | `User` |
| Create | POST | `/users` | `{username, email?, full_name?, is_active, is_system_user, password?}` | `User` (201) |
| Update | PUT | `/users/{username}` | `{email?, full_name?, is_active?, password?}` | `User` |
| Delete | DELETE | `/users/{username}` | - | 204 |
| **Role-Permission** |
| List | GET | `/role-permissions?role_code=x&permission_code=y` | - | `RolePermissionAssignment[]` |
| Get | GET | `/role-permissions/{role_code}/{permission_code}` | - | `RolePermissionAssignment` |
| Assign | POST | `/role-permissions` | `{role_code, permission_code}` | `RolePermissionAssignment` (201) |
| Remove | DELETE | `/role-permissions/{role_code}/{permission_code}` | - | 204 |
| **User-Role** |
| List | GET | `/user-roles?username=x&role_code=y` | - | `UserRoleAssignment[]` |
| Get | GET | `/user-roles/{username}/{role_code}` | - | `UserRoleAssignment` |
| Assign | POST | `/user-roles` | `{username, role_code}` | `UserRoleAssignment` (201) |
| Remove | DELETE | `/user-roles/{username}/{role_code}` | - | 204 |

### 5.2 Error Responses

| Status | Meaning | Example `detail` |
|--------|---------|------------------|
| 400 | Bad Request | `"Password required for system users"` |
| 401 | Unauthorized | `"Not authenticated"` |
| 403 | Forbidden | `"Permission denied"` |
| 404 | Not Found | `"User not found"` |
| 409 | Conflict | `"Role already exists"` |

### 5.3 Notes

- **Permission `permission_code`**: Auto-generated as `{domain}:{resource}:{action}` on create
- **User password**: Required only when `is_system_user: true`
- **Permission update**: Only `description` field is updatable

## 6. API Client

**File:** `lib/api/security.ts`

Server-side functions using `cookies()` from `next/headers`. Cookies auto-forwarded for session auth.

```typescript
import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

const BASE_URL = `${RUNTIME_CONFIG.backend.domain}/auth/config`;

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieStore.toString(),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || 'API Error');
  }
  return res.status === 204 ? (null as T) : res.json();
}

// Example implementations
export const getPermissions = () => fetchApi<Permission[]>('/permissions?limit=1000');
export const createPermission = (data: CreatePermissionInput) => 
  fetchApi<Permission>('/permissions', { method: 'POST', body: JSON.stringify(data) });
export const deletePermission = (code: string) => 
  fetchApi<void>(`/permissions/${encodeURIComponent(code)}`, { method: 'DELETE' });
```

| Entity | Functions |
|--------|-----------|
| Permission | `getPermissions()`, `getPermission(code)`, `createPermission(data)`, `updatePermission(code, data)`, `deletePermission(code)` |
| Role | `getRoles()`, `getRole(code)`, `createRole(data)`, `updateRole(code, data)`, `deleteRole(code)` |
| User | `getUsers(isSystemUser?)`, `getUser(username)`, `createUser(data)`, `updateUser(username, data)`, `deleteUser(username)` |
| Role-Permission | `getRolePermissions(roleCode?)`, `assignPermissionToRole(roleCode, permissionCode)`, `removePermissionFromRole(roleCode, permissionCode)` |
| User-Role | `getUserRoles(username?)`, `assignRoleToUser(username, roleCode)`, `removeRoleFromUser(username, roleCode)` |

## 7. Sidebar Configuration

**File:** `components/layout/Sidebar.tsx`

Update `subMenuItems['/security']`:

```typescript
import { Users, Shield, Lock } from 'lucide-react';

'/security': [
    { href: '/security/users', labelKey: 'users', icon: Users, permissions: requireAnyPermission([PERMISSIONS.UI.NAVIGATION_SECURITY]) },
    { href: '/security/roles', labelKey: 'roles', icon: Shield, permissions: requireAnyPermission([PERMISSIONS.UI.NAVIGATION_SECURITY]) },
    { href: '/security/permissions', labelKey: 'permissions', icon: Lock, permissions: requireAnyPermission([PERMISSIONS.UI.NAVIGATION_SECURITY]) },
],
```

**Files:** `messages/en.json`, `messages/zh.json` — Add to `Sidebar`:
```json
"users": "Users",           // "用户"
"roles": "Roles",           // "角色"  
"permissions": "Permissions" // "权限"
```

## 8. Component Design

### 8.1 Page Structure (Server Component)

```tsx
// app/(main)/security/permissions/page.tsx
export default async function PermissionsPage({ searchParams }: { searchParams: { selected?: string } }) {
    const permissions = await getPermissions();
    const selected = permissions.find(p => p.permission_code === searchParams.selected);
    
    return (
        <MasterDetailLayout
            master={<EntityList items={permissions} selectedId={searchParams.selected} baseUrl="/security/permissions" />}
            detail={selected ? <EntityForm entity={selected} /> : <EmptyState />}
        />
    );
}
```

### 8.2 Server Actions

```tsx
// app/(main)/security/actions.ts
'use server'
import { revalidatePath } from 'next/cache';

export async function createPermission(formData: FormData) {
    await apiCreatePermission({ ... });
    revalidatePath('/security/permissions');
}

export async function deletePermission(code: string) {
    await apiDeletePermission(code);
    revalidatePath('/security/permissions');
}
```

### 8.3 Page Data Requirements

| Page | Fetched Data | Form Fields | Assignment |
|------|--------------|-------------|------------|
| Permissions | permissions | permission_code, domain, resource, action, description | None |
| Roles | roles, permissions | role_code, name, description | Permissions |
| Users | users, roles | username, email, full_name, is_active, is_system_user, password | Roles |

## 9. Implementation Order

1. **Types & API**: `lib/types/security.ts`, `lib/api/security.ts`
2. **Config Updates**: `permissions.ts`, `Sidebar.tsx`, `messages/*.json`
3. **Common Components**: `MasterDetailLayout.tsx`, `AssignmentList.tsx`
4. **Permissions Page**: Simplest (no assignments)
5. **Roles Page**: With permission assignments
6. **Users Page**: With role assignments
7. **Cleanup**: Remove old placeholder pages (`/security/overview`, `/security/threats`, `/security/access`)

## 10. Testing

Manual verification via browser. Backend API tested with curl (session cookies):

```bash
# Login to get session cookie
curl -X POST http://localhost:8000/auth/session/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin" -c cookies.txt

# List users
curl -X GET "http://localhost:8000/auth/config/users" -b cookies.txt

# Create role
curl -X POST "http://localhost:8000/auth/config/roles" \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"role_code":"viewer","name":"Viewer","description":"Read-only"}'
```

### Verification Checklist
- [ ] CRUD operations for Permissions, Roles, Users
- [ ] Assign/remove permissions to roles
- [ ] Assign/remove roles to users
- [ ] UI reflects backend state after operations
