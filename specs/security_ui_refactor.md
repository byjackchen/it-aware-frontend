# Security UI Development Plan

## Overview
Rebuild Security UI for ABAC (Attribute-Based Access Control) backend.

**Key Changes:**
- **Account** (auth) + linked **Worker** (org identity) 
- **Groups** with scope types instead of RBAC roles
- **Roles** for hierarchy-based access control
- **APIs:** `/auth/config` + `/objects` (workers)

**Implementation Notes:**
- No backward compatibility needed
- No versioned naming in code (no xxx_v2)

---

## Data Model

### Core Entities (Security Domain)
| Entity | Purpose | API |
|--------|---------|-----|
| Account | Authentication identity | `/auth/config/accounts` |
| Group | Permission container with scope | `/auth/config/groups` |
| Role | Hierarchy scope definition | `/auth/config/roles` |
| Permission | `{domain}:{resource}:{action}` | `/auth/config/permissions` |

### Linked Objects
| Entity | Domain | API |
|--------|--------|-----|
| Worker | Objects (linked to Account) | `/objects/workers` |

### Relationships
```
Account ────► Group ────► Permission
   │ (1:1)       │ (role_based)
   ▼             ▼
Worker ─────► Role
```

### Scope Types
- **unconstrained**: No filtering (admins)
- **self_scoped**: Own records only  
- **role_based**: Filtered by hierarchy assignment

---

## UI Structure

### Pages (4 total)
**Identity Management:**
1. **Accounts** - Manage auth accounts + worker linking

**Access Control:**
2. **Groups** - Manage permission groups 
3. **Roles** - Manage hierarchy roles
4. **Permissions** - Manage permission definitions

### File Structure
```
app/(main)/security/
├── page.tsx              # Overview
├── accounts/
│   ├── page.tsx          # Accounts list (/auth/accounts)
│   ├── AccountList.tsx
│   ├── [oid]/
│   │   ├── page.tsx      # Account detail (/auth/accounts/{oid})
│   │   ├── AccountDetail.tsx
│   │   └── AccountForm.tsx
├── groups/
│   ├── page.tsx          # Groups list (/auth/groups)
│   ├── GroupList.tsx
│   ├── [oid]/
│   │   ├── page.tsx      # Group detail (/auth/groups/{oid})
│   │   ├── GroupDetail.tsx
│   │   └── GroupForm.tsx
├── roles/
│   ├── page.tsx          # Roles list (/auth/roles)
│   ├── RoleList.tsx
│   ├── [oid]/
│   │   ├── page.tsx      # Role detail (/auth/roles/{oid})
│   │   ├── RoleDetail.tsx
│   │   └── RoleForm.tsx
└── permissions/
    ├── page.tsx          # Permissions list (/auth/permissions)
    ├── PermissionList.tsx
    ├── [oid]/
    │   ├── page.tsx      # Permission detail (/auth/permissions/{oid})
    │   ├── PermissionDetail.tsx
    │   └── PermissionForm.tsx
```

---

## Key Types

```typescript
// Core Auth Types
interface Account {
  oid: string;
  username: string;
  is_active: boolean;
  is_system: boolean;
}

interface Group {
  oid: string;
  name: string;
  scope_type: 'unconstrained' | 'self_scoped' | 'role_based';
}

interface Role {
  oid: string;
  name: string;
  include_descendants: boolean;
}

interface Permission {
  oid: string;
  domain: string;
  resource: string;
  action: string;
  permission_code: string; // Computed as: {domain}:{resource}:{action}
}

// Worker (Objects Domain)
interface Worker {
  oid: string;
  full_name: string;
  email: string | null;
  org_oid: string;
  manager_oid: string | null;
  is_active: boolean;
  employee_id: string | null;
  department: string | null;
}

// Input Types
interface AccountCreate {
  username: string;
  is_system?: boolean;
  password?: string; // Required for system accounts
}

interface AccountUpdate {
  username?: string;
  is_active?: boolean;
  is_system?: boolean;
}

interface GroupCreate {
  name: string;
  scope_type: 'unconstrained' | 'self_scoped' | 'role_based';
}

interface RoleCreate {
  name: string;
  include_descendants: boolean;
}

interface PermissionCreate {
  domain: string;
  resource: string;
  action: string;
}

// Relationship Types
interface AccountGroup {
  account_oid: string;
  group_oid: string;
}

interface GroupPermission {
  group_oid: string;
  permission_oid: string;
}

interface GroupRole {
  group_oid: string;
  role_oid: string;
}

interface AccountWorker {
  account_oid: string;
  worker_oid: string;
}
```

---

## Page Designs

### Accounts Page
**List Page (/auth/accounts)**
**Layout:** List view with navigation to details

**List Columns:** Username | Type | Status | Worker | Actions

**Features:**
- Click username to navigate to account detail
- Add new account button
- Search and filter functionality

**Detail Page (/auth/accounts/{oid})**
**Layout:** Standalone account detail page

**Detail Sections:**
1. Account Info (username, type, status)
2. Linked Worker (link/unlink worker)
3. Group Assignments (add/remove groups)

**Worker Management (in Account Detail):**
- Link Worker button (searchable dialog)
- Unlink Worker
- View Worker details

**Navigation:**
- Back to accounts list
- Edit account functionality

### Groups Page  
**List Page (/auth/groups)**
**Layout:** List view with navigation to details

**List Columns:** Name | Scope Type | Permissions | Roles | Actions

**Features:**
- Click name to navigate to group detail
- Add new group button
- Search and filter functionality

**Detail Page (/auth/groups/{oid})**
**Layout:** Standalone group detail page

**Detail Sections:**
1. Group Info (name, scope type)
2. Permission Assignments
3. Role Links (if role_based)

**Navigation:**
- Back to groups list
- Edit group functionality

### Roles Page
**List Page (/auth/roles)**
**Layout:** List view with navigation to details

**List Columns:** Name | Include Descendants | Groups | Workers | Actions

**Features:**
- Click name to navigate to role detail
- Add new role button
- Search and filter functionality

**Detail Page (/auth/roles/{oid})**
**Layout:** Standalone role detail page

**Detail Sections:**
1. Role Info
2. Linked Groups
3. Worker Assignments

**Navigation:**
- Back to roles list
- Edit role functionality

### Permissions Page
**List Page (/auth/permissions)**
**Layout:** List view with navigation to details

**List Columns:** Permission Code | Domain | Resource | Action | Groups | Actions

**Features:**
- Click permission code to navigate to permission detail
- Add new permission button
- Search and filter functionality

**Detail Page (/auth/permissions/{oid})**
**Layout:** Standalone permission detail page

**Detail Sections:**
1. Permission Info (code breakdown)
2. Assigned Groups

**Navigation:**
- Back to permissions list
- Edit permission functionality

---

## Implementation Plan

### Development Strategy
**Build Accounts page first** - establishes patterns for ABAC model and Account-Worker relationships.

### Accounts Page Phases

#### Phase 1: Core Account Management
- AccountList page (/auth/accounts) - list view with navigation
- AccountDetail page (/auth/accounts/{oid}) - standalone detail view
- AccountForm (create/edit accounts)

#### Phase 2: Worker Integration
- WorkerLinkManager (link/unlink workers)
- Worker selection dialog (searchable, filter unlinked)

#### Phase 3: Group Assignment
- GroupAssignmentManager (add/remove groups from account)

#### Phase 4: Advanced Features
- Bulk operations
- Enhanced filtering

### Data Flow Pattern
```
AccountListPage (/auth/accounts) (Server)
├── fetches: accounts list
└── passes data → AccountList (Client)
    └── Click username → navigate to /auth/accounts/{oid}

AccountDetailPage (/auth/accounts/{oid}) (Server)  
├── receives: account OID from URL params
├── fetches: account details, linked worker, groups
└── renders: account info + worker management + groups
```

### Next Steps (After Accounts Page)
1. Permissions page (simplest - good for learning patterns)
2. Roles page  
3. Groups page (complex relationships)
4. Integration testing

---

## Open Questions (ANSWERED)

### Q1: Sidebar Structure
**ANSWER:** Option A - Flat list (Accounts, Groups, Roles, Permissions)

### Q2: Permission Display
**ANSWER:** Display permission_code and use OID internally

### Q3: Error Handling  
**ANSWER:** Display errors on the top right corner within the page area

### Q4: Pagination
**ANSWER:** Use server-side pagination if possible

### Q5: i18n
**ANSWER:** Yes, all screen labels need i18n

---

**Status: REFINED AND READY FOR DEVELOPMENT**

Document has been reviewed and refined for:
- ✅ Consistent naming conventions
- ✅ Complete type definitions  
- ✅ Enhanced list view columns
- ✅ Clear development priorities
- ✅ Relationship interfaces defined

**Ready for Accounts page implementation.**
**Next Steps After Review:**
1. Begin Accounts page implementation (Phase 1)
2. Create TypeScript types and API clients
3. Update sidebar navigation structure

---

## Required Permissions

### Navigation
| Page | Permission Required |
|------|-------------------|
| Accounts List | `auth:accounts:read` |
| Account Detail | `auth:accounts:read` |
| Groups List | `auth:groups:read` |
| Group Detail | `auth:groups:read` |
| Roles List | `auth:roles:read` |
| Role Detail | `auth:roles:read` |
| Permissions List | `auth:permissions:read` |
| Permission Detail | `auth:permissions:read` |

### Actions
| Action | Permission Required |
|--------|-------------------|
| Account CRUD | `auth:accounts:edit` |
| Account-Worker Link | `auth:account_workers:edit` |
| Group CRUD | `auth:groups:edit` |
| Group Assignments | `auth:group_permissions:edit`, `auth:group_roles:edit` |
| Role CRUD | `auth:roles:edit` |
| Permission CRUD | `auth:permissions:edit` |
