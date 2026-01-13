# Component Data Flow

> Quick reference for which backend APIs each frontend page consumes, distinguishing between Server Components, Client Components, and mutation strategies.

---

## Architecture Overview

**Data Fetching Strategy**:
1. **Server Components (`page.tsx`)**: Fetch initial data directly via `lib/api/*` functions.
2. **Client Components (`*Page.tsx`)**: Receive data as props.
3. **Mutations**: Triggered via **Server Actions** (`app/actions/*`) which call `lib/api/*` and revalidate paths.
4. **Client-side Fetching**: Used sparingly for search (`/api/search`) and session checks (`/api/auth/me`).

```mermaid
graph TD
    subgraph Server_Layer
        Page[Server Page (page.tsx)]
        Action[Server Action]
        API_Route[API Route (/api/*)]
    end
    
    subgraph Client_Layer
        ClientUI[Client Component (*Page.tsx)]
    end
    
    subgraph Backend
        BackendAPI[Backend Service]
    end

    Page -- "1. Fetch Initial Data" --> BackendAPI
    Page -- "2. Pass Data Props" --> ClientUI
    ClientUI -- "3. User Interaction" --> Action
    Action -- "4. Mutate Data" --> BackendAPI
    ClientUI -- "5. Client Fetch (Search/Auth)" --> API_Route
    API_Route -- "6. Proxy Request" --> BackendAPI
```

---

## Auth Section (`/auth/*`)

### Accounts

| Component | Type | Responsibility | APIs / Actions Used |
|-----------|------|----------------|---------------------|
| `page.tsx` | **Server** | Initial Fetch | **Read**: `getAccounts`, `getWorkers`, `getAccountWorkers` |
| `AccountsListPage.tsx` | **Client** | UI & Navigation | — |
| `[oid]/page.tsx` | **Server** | Detail Fetch | **Read**: `getAccount`, `getWorkers`, `getGroups`, `getAccountWorkers`, `getAccountGroups` |
| `AccountDetailPage.tsx` | **Client** | Edit/Delete | **Write**: `updateAccount`, `deleteAccount`, `linkAccountWorker`, `unlinkAccountWorker`, `assignAccountGroup`, `removeAccountGroup` (via `actions/security.ts`) |
| `new/page.tsx` | **Server** | — | — |
| `AccountCreatePage.tsx` | **Client** | Create Form | **Write**: `createAccount` (via `actions/security.ts`) |

### Groups

| Component | Type | Responsibility | APIs / Actions Used |
|-----------|------|----------------|---------------------|
| `page.tsx` | **Server** | Initial Fetch | **Read**: `getGroups` |
| `GroupsListPage.tsx` | **Client** | UI & Navigation | — |
| `[oid]/page.tsx` | **Server** | Detail Fetch | **Read**: `getGroup`, `getPermissions`, `getRoles`, `getGroupPermissions`, `getGroupRoles` |
| `GroupDetailPage.tsx` | **Client** | Edit/Delete | **Write**: `updateGroup`, `deleteGroup`, `assignGroupPermission`, `removeGroupPermission`, `linkGroupRole`, `unlinkGroupRole` (via `actions/security.ts`) |
| `new/page.tsx` | **Server** | — | — |
| `GroupCreatePage.tsx` | **Client** | Create Form | **Write**: `createGroup` (via `actions/security.ts`) |

### Roles

| Component | Type | Responsibility | APIs / Actions Used |
|-----------|------|----------------|---------------------|
| `page.tsx` | **Server** | Initial Fetch | **Read**: `getRoles` |
| `RolesListPage.tsx` | **Client** | UI & Navigation | — |
| `[oid]/page.tsx` | **Server** | Detail Fetch | **Read**: `getRole`, `getGroups`, `getGroupRoles` |
| `RoleDetailPage.tsx` | **Client** | Edit/Delete | **Write**: `updateRole`, `deleteRole` (via `actions/security.ts`) |

### Permissions

| Component | Type | Responsibility | APIs / Actions Used |
|-----------|------|----------------|---------------------|
| `page.tsx` | **Server** | Initial Fetch | **Read**: `getPermissions` |
| `PermissionsListPage.tsx` | **Client** | UI & Navigation | — |
| `[oid]/page.tsx` | **Server** | Detail Fetch | **Read**: `getPermission`, `getGroups`, `getGroupPermissions` |
| `PermissionDetailPage.tsx` | **Client** | Delete | **Write**: `deletePermission` (via `actions/security.ts`) |

---

## Data Section (`/data/*`)

### Workers

| Component | Type | Responsibility | APIs / Actions Used |
|-----------|------|----------------|---------------------|
| `page.tsx` | **Server** | Initial Fetch | **Read**: `getWorkers`, `getOrganizations` |
| `WorkersListPage.tsx` | **Client** | UI & Search | **Read**: Search uses local filtering |
| `[oid]/page.tsx` | **Server** | Detail Fetch | **Read**: `getWorker`, `getConnectedEdges`, `getOrganizations`, `getLocations`, `getWorkerHardwares` |
| `WorkerDetailPage.tsx` | **Client** | Edit/Delete | **Write**: `updateWorker`, `deleteWorker`, `createWorkerHardware`, `updateWorkerHardware`, `deleteWorkerHardware` (via `actions/objects.ts`) <br> **Read**: `getTicket` (lazy load tabs) |
| `new/page.tsx` | **Server** | Fetch Options | **Read**: `getOrganizations`, `getLocations` |
| `WorkerCreatePage.tsx` | **Client** | Create Form | **Write**: `createWorker` (via `actions/objects.ts`) |

### Tickets

| Component | Type | Responsibility | APIs / Actions Used |
|-----------|------|----------------|---------------------|
| `page.tsx` | **Server** | Initial Fetch | **Read**: `getTickets`, `getOrganizations`, `getWorkers` |
| `TicketsListPage.tsx` | **Client** | UI & Search | — |
| `[oid]/page.tsx` | **Server** | Detail Fetch | **Read**: `getTicket`, `getConnectedEdges`, `getOrganizations`, `getWorkers` |
| `TicketDetailPage.tsx` | **Client** | Edit/Delete | **Write**: `updateTicketAction`, `deleteTicketAction` (via `actions/objects.ts`) |
| `new/page.tsx` | **Server** | Fetch Options | **Read**: `getWorkers` (active only) |
| `NewTicketPage.tsx` | **Client** | Create Form | **Write**: `createTicketAction` (via `actions/objects.ts`) |

### Organizations

| Component | Type | Responsibility | APIs / Actions Used |
|-----------|------|----------------|---------------------|
| `page.tsx` | **Server** | Fetch Tree | **Read**: `getOrganizations` |
| `OrganizationsListPage.tsx`| **Client** | UI Tree View | — |
| `[oid]/page.tsx` | **Server** | Detail Fetch | **Read**: `getOrganization`, `getOrganizations`, `getConnectedEdges`, `getWorkerHierarchyRoles`, `getWorkers`, `getRoles` |
| `OrganizationDetailPage.tsx`| **Client** | Edit/Delete | **Write**: `updateOrganization`, `deleteOrganization`, `assignWorkerHierarchyRole`, `removeWorkerHierarchyRole` (via `actions/objects.ts`) |

### Locations

| Component | Type | Responsibility | APIs / Actions Used |
|-----------|------|----------------|---------------------|
| `page.tsx` | **Server** | Fetch Tree | **Read**: `getLocations` |
| `LocationsListPage.tsx` | **Client** | UI Tree View | — |
| `[oid]/page.tsx` | **Server** | Detail Fetch | **Read**: `getLocation`, `getLocations`, `getConnectedEdges`, `getWorkerHierarchyRoles`, `getWorkers`, `getRoles` |
| `LocationDetailPage.tsx` | **Client** | Edit/Delete | **Write**: `updateLocation`, `deleteLocation`, `assignWorkerHierarchyRole`, `removeWorkerHierarchyRole` (via `actions/objects.ts`) |

### Service Catalogs

| Component | Type | Responsibility | APIs / Actions Used |
|-----------|------|----------------|---------------------|
| `page.tsx` | **Server** | Fetch Tree | **Read**: `getServiceCatalogs` |
| `ServiceCatalogsListPage.tsx`| **Client** | UI Tree View | — |
| `[oid]/page.tsx` | **Server** | Detail Fetch | **Read**: `getServiceCatalog`, `getServiceCatalogs`, `getConnectedEdges`, `getWorkerHierarchyRoles`, `getWorkers`, `getRoles` |
| `ServiceCatalogDetailPage.tsx`| **Client** | Edit/Delete | **Write**: `updateServiceCatalog`, `deleteServiceCatalog`, `assignWorkerHierarchyRole`, `removeWorkerHierarchyRole` (via `actions/objects.ts`) |

### Articles

| Component | Type | Responsibility | APIs / Actions Used |
|-----------|------|----------------|---------------------|
| `page.tsx` | **Server** | Initial Fetch | **Read**: `getArticles`, `getServiceCatalogs` |
| `ArticlesListPage.tsx` | **Client** | UI & Search | — |
| `[oid]/page.tsx` | **Server** | Detail Fetch | **Read**: `getArticle`, `getArticleVersions`, `getConnectedEdges`, `getServiceCatalogs` |
| `ArticleDetailPage.tsx` | **Client** | Edit/Delete | **Write**: `updateArticle`, `deleteArticle` (via `actions/objects.ts`) |

---

## Special Components & API Routes

### 1. Global Search
- **Component**: `GlobalSearch.tsx` (Client)
- **Method**: Client-side fetch
- **Endpoint**: `/api/search` (Next.js API Route)
- **Controller**: `app/api/search/route.ts`
- **Backend**: Proxies request to `/registry/search`

### 2. Session Management
- **Component**: `AuthProvider.tsx` / `UserMenu.tsx` (Client)
- **Method**: Client-side fetch
- **Endpoint**: `/api/auth/me` (Next.js API Route)
- **Controller**: `app/api/auth/me/route.ts`
- **Backend**: Proxies request to `/auth/me`

### 3. Knowledge Layout
- **Component**: `app/(main)/knowledge/layout.tsx`
- **Type**: **Server Component**
- **Responsibility**: Fetches Catalog structure for the sidebar
- **APIs**: `getServiceCatalogs`

### 4. Persona Profile
- **Component**: `app/(main)/persona/page.tsx`
- **Type**: **Server Component**
- **Responsibility**: Fetches initial worker data
- **APIs**: `getWorkers`, `getOrganizations`, `getLocations`, `getWorkerHardwares`
- **Note**: Passes data to `PersonaProfilePage.tsx` (Client) which handles tab switching locally.

---

## Server Actions Reference

Mutations are strictly handled by Server Actions. Client components import specifically from these files.

| Action File | Domain | Mutation Capabilities |
|-------------|--------|-----------------------|
| `app/actions/objects.ts` | **Data** | • `create/update/delete` for: `Organization`, `Location`, `ServiceCatalog`, `Worker`, `Ticket`, `Article`<br>• `assign/remove` for: `WorkerHierarchyRole` |
| `app/actions/security.ts` | **Auth** | • `create/update/delete` for: `Account`, `Group`, `Role`, `Permission`<br>• `assign/link/remove` for: `AccountGroup`, `AccountWorker`, `GroupPermission`, `GroupRole` |
