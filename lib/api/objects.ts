/**
 * Server-side API client for Objects module (organizations, locations, workers, tickets).
 * Also includes edges and worker-hierarchy-role APIs.
 */

// cookies and redirect removed as they are now used in core.ts
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type {
    Organization,
    OrganizationCreate,
    OrganizationUpdate,
    Location,
    LocationCreate,
    LocationUpdate,
    ServiceCatalog,
    ServiceCatalogCreate,
    ServiceCatalogUpdate,
    Worker,
    WorkerCreate,
    WorkerUpdate,
    Ticket,
    TicketCreate,
    TicketUpdate,
    WorkerHierarchyRole,
    WorkerHierarchyRoleCreate,
    GlobalEdge,
    GlobalEdgeListResponse,
    Article,
    ArticleCreate,
    ArticleUpdate,
    ArticleVersion,
} from '@/lib/types/objects';
import type { Role } from '@/lib/types/security';

const OBJECTS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects`;
const HIERARCHIES_BASE = `${RUNTIME_CONFIG.backend.domain}/hierarchies`;
const EDGES_BASE = `${RUNTIME_CONFIG.backend.domain}/edges`;
const AUTH_CONFIG_BASE = `${RUNTIME_CONFIG.backend.domain}/auth/config`;

// ============================================================================
// Core API Fetch Function
// ============================================================================

import { fetchApi } from '@/lib/api/core';

// ============================================================================
// Core API Fetch Function
// ============================================================================

// fetchApi moved to @/lib/api/core.ts

// ============================================================================
// Pagination Helper
// ============================================================================

const PAGE_SIZE = 1000; // API maximum
const MAX_PAGES = 100; // Safety limit: 100k max items

async function fetchAllPages<T extends { oid: string }>(baseUrl: string): Promise<T[]> {
    const allResults: T[] = [];
    const seenOids = new Set<string>();
    let skip = 0;
    let pageCount = 0;
    let consecutiveDuplicatePages = 0;

    while (pageCount < MAX_PAGES) {
        const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}limit=${PAGE_SIZE}&skip=${skip}`;
        const page = await fetchApi<T[]>(url);

        // Add only new items (deduplicate)
        const newItems = page.filter(item => !seenOids.has(item.oid));
        newItems.forEach(item => {
            seenOids.add(item.oid);
            allResults.push(item);
        });

        // Track consecutive pages with all duplicates (indicates API issue)
        if (newItems.length === 0 && page.length > 0) {
            consecutiveDuplicatePages++;
            // Only stop if we see 3+ consecutive duplicate pages (API definitely broken)
            if (consecutiveDuplicatePages >= 3) {
                console.warn(`[fetchAllPages] 3+ consecutive duplicate pages at skip=${skip}. Stopping.`);
                break;
            }
        } else {
            consecutiveDuplicatePages = 0;
        }

        // If we got fewer than PAGE_SIZE, we've reached the end
        if (page.length < PAGE_SIZE) {
            break;
        }
        skip += PAGE_SIZE;
        pageCount++;
    }

    console.log(`[fetchAllPages] Fetched ${allResults.length} unique items in ${pageCount + 1} pages from ${baseUrl}`);
    return allResults;
}

// ============================================================================
// Organization APIs
// ============================================================================

export async function getOrganizations(): Promise<Organization[]> {
    return fetchAllPages<Organization>(`${HIERARCHIES_BASE}/organizations`);
}

export async function getOrganization(oid: string): Promise<Organization> {
    return fetchApi<Organization>(`${HIERARCHIES_BASE}/organizations/${encodeURIComponent(oid)}`);
}

export async function createOrganization(data: OrganizationCreate): Promise<Organization> {
    return fetchApi<Organization>(`${HIERARCHIES_BASE}/organizations`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateOrganization(oid: string, data: OrganizationUpdate): Promise<Organization> {
    return fetchApi<Organization>(`${HIERARCHIES_BASE}/organizations/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteOrganization(oid: string): Promise<void> {
    return fetchApi<void>(`${HIERARCHIES_BASE}/organizations/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

// ============================================================================
// Location APIs
// ============================================================================

export async function getLocations(): Promise<Location[]> {
    return fetchAllPages<Location>(`${HIERARCHIES_BASE}/locations`);
}

export async function getLocation(oid: string): Promise<Location> {
    return fetchApi<Location>(`${HIERARCHIES_BASE}/locations/${encodeURIComponent(oid)}`);
}

export async function createLocation(data: LocationCreate): Promise<Location> {
    return fetchApi<Location>(`${HIERARCHIES_BASE}/locations`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateLocation(oid: string, data: LocationUpdate): Promise<Location> {
    return fetchApi<Location>(`${HIERARCHIES_BASE}/locations/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteLocation(oid: string): Promise<void> {
    return fetchApi<void>(`${HIERARCHIES_BASE}/locations/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

// ============================================================================
// Service Catalog APIs
// ============================================================================

export async function getServiceCatalogs(): Promise<ServiceCatalog[]> {
    return fetchAllPages<ServiceCatalog>(`${HIERARCHIES_BASE}/service-catalogs`);
}

export async function getServiceCatalog(oid: string): Promise<ServiceCatalog> {
    return fetchApi<ServiceCatalog>(`${HIERARCHIES_BASE}/service-catalogs/${encodeURIComponent(oid)}`);
}

export async function createServiceCatalog(data: ServiceCatalogCreate): Promise<ServiceCatalog> {
    return fetchApi<ServiceCatalog>(`${HIERARCHIES_BASE}/service-catalogs`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateServiceCatalog(oid: string, data: ServiceCatalogUpdate): Promise<ServiceCatalog> {
    return fetchApi<ServiceCatalog>(`${HIERARCHIES_BASE}/service-catalogs/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteServiceCatalog(oid: string): Promise<void> {
    return fetchApi<void>(`${HIERARCHIES_BASE}/service-catalogs/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

// ============================================================================
// Worker APIs
// ============================================================================

export async function getWorkers(isActive?: boolean): Promise<Worker[]> {
    let baseUrl = `${OBJECTS_BASE}/workers`;
    if (isActive !== undefined) {
        baseUrl += `?is_active=${String(isActive)}`;
    }
    return fetchAllPages<Worker>(baseUrl);
}

export async function getWorker(oid: string): Promise<Worker> {
    return fetchApi<Worker>(`${OBJECTS_BASE}/workers/${encodeURIComponent(oid)}`);
}

export async function createWorker(data: WorkerCreate): Promise<Worker> {
    return fetchApi<Worker>(`${OBJECTS_BASE}/workers`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateWorker(oid: string, data: WorkerUpdate): Promise<Worker> {
    return fetchApi<Worker>(`${OBJECTS_BASE}/workers/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteWorker(oid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/workers/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

// ============================================================================
// Ticket APIs
// ============================================================================

export async function getTickets(status?: string): Promise<Ticket[]> {
    const params = new URLSearchParams({ limit: '1000' });
    if (status) {
        params.set('status', status);
    }
    return fetchApi<Ticket[]>(`${OBJECTS_BASE}/tickets?${params.toString()}`);
}

export async function getTicket(oid: string): Promise<Ticket> {
    return fetchApi<Ticket>(`${OBJECTS_BASE}/tickets/${encodeURIComponent(oid)}`);
}

export async function createTicket(data: TicketCreate): Promise<Ticket> {
    return fetchApi<Ticket>(`${OBJECTS_BASE}/tickets`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateTicket(oid: string, data: TicketUpdate): Promise<Ticket> {
    return fetchApi<Ticket>(`${OBJECTS_BASE}/tickets/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteTicket(oid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/tickets/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

// ============================================================================
// Worker-Hierarchy-Role APIs
// ============================================================================

export async function getWorkerHierarchyRoles(
    workerOid?: string,
    roleOid?: string,
    hierarchyOid?: string
): Promise<WorkerHierarchyRole[]> {
    const params = new URLSearchParams({ limit: '1000' });
    if (workerOid) params.set('worker_oid', workerOid);
    if (roleOid) params.set('role_oid', roleOid);
    if (hierarchyOid) params.set('hierarchy_oid', hierarchyOid);
    return fetchApi<WorkerHierarchyRole[]>(`${OBJECTS_BASE}/worker-hierarchy-roles?${params.toString()}`);
}

export async function assignWorkerHierarchyRole(data: WorkerHierarchyRoleCreate): Promise<WorkerHierarchyRole> {
    return fetchApi<WorkerHierarchyRole>(`${OBJECTS_BASE}/worker-hierarchy-roles`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function removeWorkerHierarchyRole(
    workerOid: string,
    roleOid: string,
    hierarchyOid: string
): Promise<void> {
    return fetchApi<void>(
        `${OBJECTS_BASE}/worker-hierarchy-roles/${encodeURIComponent(workerOid)}/${encodeURIComponent(roleOid)}/${encodeURIComponent(hierarchyOid)}`,
        { method: 'DELETE' }
    );
}

// ============================================================================
// Edge APIs
// ============================================================================

export async function getConnectedEdges(
    oid: string,
    edgeType?: string,
    isActive?: boolean,
    includeObjects = true
): Promise<GlobalEdgeListResponse> {
    const params = new URLSearchParams({ page_size: '100', include_objects: String(includeObjects) });
    if (edgeType) params.set('edge_type', edgeType);
    if (isActive !== undefined) params.set('is_active', String(isActive));
    return fetchApi<GlobalEdgeListResponse>(`${EDGES_BASE}/connected/${encodeURIComponent(oid)}?${params.toString()}`);
}

export async function getEdgesFrom(
    oid: string,
    edgeType?: string,
    includeObjects = true
): Promise<GlobalEdgeListResponse> {
    const params = new URLSearchParams({ page_size: '100', include_objects: String(includeObjects) });
    if (edgeType) params.set('edge_type', edgeType);
    return fetchApi<GlobalEdgeListResponse>(`${EDGES_BASE}/from/${encodeURIComponent(oid)}?${params.toString()}`);
}

export async function getEdgesTo(
    oid: string,
    edgeType?: string,
    includeObjects = true
): Promise<GlobalEdgeListResponse> {
    const params = new URLSearchParams({ page_size: '100', include_objects: String(includeObjects) });
    if (edgeType) params.set('edge_type', edgeType);
    return fetchApi<GlobalEdgeListResponse>(`${EDGES_BASE}/to/${encodeURIComponent(oid)}?${params.toString()}`);
}

export async function getEdgeTypes(): Promise<string[]> {
    return fetchApi<string[]>(`${EDGES_BASE}/types`);
}

// ============================================================================
// Role APIs (from auth module, for role-worker assignments)
// ============================================================================

export async function getRoles(): Promise<Role[]> {
    return fetchApi<Role[]>(`${AUTH_CONFIG_BASE}/roles?limit=1000`);
}

// ============================================================================
// Article APIs
// ============================================================================

export async function getArticles(serviceCatalogId?: string, isActive?: boolean): Promise<Article[]> {
    const params = new URLSearchParams();
    if (serviceCatalogId) params.append('service_catalog_id', serviceCatalogId);
    if (isActive !== undefined) params.append('is_active', String(isActive));

    // Note: fetchAllPages expects a full URL if fetchApi expects a full URL (or base + relative).
    // But fetchAllPages implementation simply appends query params to baseUrl.
    // Ideally we pass full URL here.
    const queryString = params.toString();
    const url = `${OBJECTS_BASE}/articles${queryString ? `?${queryString}` : ''}`;

    return fetchAllPages(url);
}

export async function getArticle(oid: string): Promise<Article> {
    return fetchApi(`${OBJECTS_BASE}/articles/${oid}`);
}

export async function createArticle(data: ArticleCreate): Promise<Article> {
    return fetchApi(`${OBJECTS_BASE}/articles`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function updateArticle(oid: string, data: ArticleUpdate): Promise<Article> {
    return fetchApi(`${OBJECTS_BASE}/articles/${oid}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function deleteArticle(oid: string): Promise<void> {
    return fetchApi(`${OBJECTS_BASE}/articles/${oid}`, {
        method: 'DELETE',
    });
}

export async function getArticleVersions(oid: string): Promise<ArticleVersion[]> {
    return fetchApi(`${OBJECTS_BASE}/articles/${oid}/versions`);
}

export async function getArticleVersion(oid: string, versionNumber: number): Promise<ArticleVersion> {
    return fetchApi(`${OBJECTS_BASE}/articles/${oid}/versions/${versionNumber}`);
}
