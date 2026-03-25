/**
 * Server-side API client for Objects module (organizations, locations, workers, service catalogs, articles).
 * Also includes edges, activities (incidents/requests/inquiries/interactions), and worker-hierarchy-role APIs.
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
    WorkerProfile,
    WorkerProfileUpsert,
    WorkerHardware,
    WorkerHardwareCreate,
    WorkerHardwareUpdate,
    WorkerHierarchyRole,
    WorkerHierarchyRoleCreate,
    GlobalEdgeListResponse,
    Article,
    ArticleCreate,
    ArticleUpdate,
    ArticleVersion,
    Incident,
    IncidentListParams,
    IncidentListResponse,
    IncidentCreate,
    IncidentUpdate,
    Inquiry,
    InquiryListParams,
    InquiryListResponse,
    InquiryCreate,
    InquiryUpdate,
    Request,
    RequestListParams,
    RequestListResponse,
    RequestCreate,
    RequestUpdate,
    Interaction,
    InteractionListParams,
    InteractionListResponse,
} from '@/lib/types/objects';
import type { Role } from '@/lib/types/security';

const OBJECTS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects`;
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
const DEFAULT_PAGE_LIMIT = 100;

interface PagedListParams {
    limit?: number;
    skip?: number;
}

interface ActivePagedListParams extends PagedListParams {
    isActive?: boolean;
}

interface ListEnvelope<T> {
    items: T[];
    total?: number;
    skip?: number;
    limit?: number;
}

function buildPagedUrl(baseUrl: string, params: PagedListParams = {}, isActive?: boolean): string {
    const query = new URLSearchParams();
    query.set('limit', String(params.limit ?? DEFAULT_PAGE_LIMIT));
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (isActive !== undefined) query.set('is_active', String(isActive));
    return `${baseUrl}?${query.toString()}`;
}

function isListEnvelope<T>(value: unknown): value is ListEnvelope<T> {
    if (!value || typeof value !== 'object') return false;
    return Array.isArray((value as { items?: unknown }).items);
}

function ensureListEnvelope<T>(value: unknown, endpoint: string): ListEnvelope<T> {
    if (!isListEnvelope<T>(value)) {
        throw new Error(`Unexpected list response shape from ${endpoint}`);
    }
    return value;
}

function getListTotal<T>(value: ListEnvelope<T>): number | null {
    if (typeof value.total !== 'number' || !Number.isFinite(value.total)) return null;
    return value.total;
}

async function fetchAllPages<T extends { oid: string }>(baseUrl: string): Promise<T[]> {
    const allResults: T[] = [];
    const seenOids = new Set<string>();
    let skip = 0;
    let pageCount = 0;
    let consecutiveDuplicatePages = 0;
    let knownTotal: number | null = null;

    while (pageCount < MAX_PAGES) {
        const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}limit=${PAGE_SIZE}&skip=${skip}`;
        const response = await fetchApi<ListEnvelope<T>>(url);
        const envelope = ensureListEnvelope<T>(response, url);
        const page = envelope.items;
        if (knownTotal === null) {
            knownTotal = getListTotal(envelope);
        }

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

        if (typeof knownTotal === 'number' && Number.isFinite(knownTotal) && allResults.length >= knownTotal) {
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
    return fetchAllPages<Organization>(`${OBJECTS_BASE}/organizations`);
}

export async function getOrganizationsPage(params: PagedListParams = {}): Promise<Organization[]> {
    const url = buildPagedUrl(`${OBJECTS_BASE}/organizations`, params);
    const response = await fetchApi<ListEnvelope<Organization>>(url);
    return ensureListEnvelope<Organization>(response, url).items;
}

export async function getOrganization(oid: string): Promise<Organization> {
    return fetchApi<Organization>(`${OBJECTS_BASE}/organizations/${encodeURIComponent(oid)}`);
}

export async function createOrganization(data: OrganizationCreate): Promise<Organization> {
    return fetchApi<Organization>(`${OBJECTS_BASE}/organizations`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateOrganization(oid: string, data: OrganizationUpdate): Promise<Organization> {
    return fetchApi<Organization>(`${OBJECTS_BASE}/organizations/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteOrganization(oid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/organizations/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

// ============================================================================
// Location APIs
// ============================================================================

export async function getLocations(): Promise<Location[]> {
    return fetchAllPages<Location>(`${OBJECTS_BASE}/locations`);
}

export async function getLocationsPage(params: PagedListParams = {}): Promise<Location[]> {
    const url = buildPagedUrl(`${OBJECTS_BASE}/locations`, params);
    const response = await fetchApi<ListEnvelope<Location>>(url);
    return ensureListEnvelope<Location>(response, url).items;
}

export async function getLocation(oid: string): Promise<Location> {
    return fetchApi<Location>(`${OBJECTS_BASE}/locations/${encodeURIComponent(oid)}`);
}

export async function createLocation(data: LocationCreate): Promise<Location> {
    return fetchApi<Location>(`${OBJECTS_BASE}/locations`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateLocation(oid: string, data: LocationUpdate): Promise<Location> {
    return fetchApi<Location>(`${OBJECTS_BASE}/locations/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteLocation(oid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/locations/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

// ============================================================================
// Service Catalog APIs
// ============================================================================

export async function getServiceCatalogs(): Promise<ServiceCatalog[]> {
    return fetchAllPages<ServiceCatalog>(`${OBJECTS_BASE}/service-catalogs`);
}

export async function getServiceCatalogsPage(params: PagedListParams = {}): Promise<ServiceCatalog[]> {
    const url = buildPagedUrl(`${OBJECTS_BASE}/service-catalogs`, params);
    const response = await fetchApi<ListEnvelope<ServiceCatalog>>(url);
    return ensureListEnvelope<ServiceCatalog>(response, url).items;
}

export async function getServiceCatalog(oid: string): Promise<ServiceCatalog> {
    return fetchApi<ServiceCatalog>(`${OBJECTS_BASE}/service-catalogs/${encodeURIComponent(oid)}`);
}

export async function createServiceCatalog(data: ServiceCatalogCreate): Promise<ServiceCatalog> {
    return fetchApi<ServiceCatalog>(`${OBJECTS_BASE}/service-catalogs`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateServiceCatalog(oid: string, data: ServiceCatalogUpdate): Promise<ServiceCatalog> {
    return fetchApi<ServiceCatalog>(`${OBJECTS_BASE}/service-catalogs/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteServiceCatalog(oid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/service-catalogs/${encodeURIComponent(oid)}`, {
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

export async function getWorkersPage(params: ActivePagedListParams = {}): Promise<Worker[]> {
    const url = buildPagedUrl(`${OBJECTS_BASE}/workers`, params, params.isActive);
    const response = await fetchApi<ListEnvelope<Worker>>(url);
    return ensureListEnvelope<Worker>(response, url).items;
}

export async function getWorker(oid: string): Promise<Worker> {
    return fetchApi<Worker>(`${OBJECTS_BASE}/workers/detail?oid=${encodeURIComponent(oid)}`);
}

export async function getWorkerProfile(workerOid: string): Promise<WorkerProfile | null> {
    try {
        return await fetchApi<WorkerProfile>(`${OBJECTS_BASE}/workers/profile?worker_oid=${encodeURIComponent(workerOid)}`);
    } catch (error) {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (
                message === 'profile not found' ||
                message === 'not found' ||
                message.includes('profile not found') ||
                message.includes('404')
            ) {
                return null;
            }
        }
        throw error;
    }
}

export async function createWorker(data: WorkerCreate): Promise<Worker> {
    return fetchApi<Worker>(`${OBJECTS_BASE}/workers`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateWorker(oid: string, data: WorkerUpdate): Promise<Worker> {
    return fetchApi<Worker>(`${OBJECTS_BASE}/workers/detail?oid=${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteWorker(oid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/workers/detail?oid=${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

export async function upsertWorkerProfile(workerOid: string, data: WorkerProfileUpsert): Promise<WorkerProfile> {
    return fetchApi<WorkerProfile>(`${OBJECTS_BASE}/workers/profile?worker_oid=${encodeURIComponent(workerOid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

// ============================================================================
// Worker Hardware APIs
// ============================================================================

export async function getWorkerHardwares(workerOid: string, includeInactive: boolean = false): Promise<WorkerHardware[]> {
    const params = new URLSearchParams();
    if (includeInactive) params.append('is_active', 'false');
    else params.append('is_active', 'true');

    return fetchApi<WorkerHardware[]>(`${OBJECTS_BASE}/workers/hardwares?worker_oid=${encodeURIComponent(workerOid)}&${params.toString()}`);
}

export async function createWorkerHardware(workerOid: string, data: WorkerHardwareCreate): Promise<WorkerHardware> {
    return fetchApi<WorkerHardware>(`${OBJECTS_BASE}/workers/hardwares?worker_oid=${encodeURIComponent(workerOid)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function updateWorkerHardware(workerOid: string, hardwareOid: string, data: WorkerHardwareUpdate): Promise<WorkerHardware> {
    return fetchApi<WorkerHardware>(`${OBJECTS_BASE}/workers/hardwares/detail?worker_oid=${encodeURIComponent(workerOid)}&hardware_oid=${encodeURIComponent(hardwareOid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function deleteWorkerHardware(workerOid: string, hardwareOid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/workers/hardwares/detail?worker_oid=${encodeURIComponent(workerOid)}&hardware_oid=${encodeURIComponent(hardwareOid)}`, {
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
    includeObjects = true,
    effectiveAtFrom?: string,
    effectiveAtTo?: string
): Promise<GlobalEdgeListResponse> {
    const params = new URLSearchParams({ page_size: '100', include_objects: String(includeObjects) });
    if (edgeType) params.set('edge_type', edgeType);
    if (isActive !== undefined) params.set('is_active', String(isActive));
    if (effectiveAtFrom) params.set('effective_at_from', effectiveAtFrom);
    if (effectiveAtTo) params.set('effective_at_to', effectiveAtTo);
    return fetchApi<GlobalEdgeListResponse>(`${EDGES_BASE}/connected/${encodeURIComponent(oid)}?${params.toString()}`);
}

export async function getEdgesFrom(
    oid: string,
    edgeType?: string,
    includeObjects = true,
    effectiveAtFrom?: string,
    effectiveAtTo?: string
): Promise<GlobalEdgeListResponse> {
    const params = new URLSearchParams({ page_size: '100', include_objects: String(includeObjects) });
    if (edgeType) params.set('edge_type', edgeType);
    if (effectiveAtFrom) params.set('effective_at_from', effectiveAtFrom);
    if (effectiveAtTo) params.set('effective_at_to', effectiveAtTo);
    return fetchApi<GlobalEdgeListResponse>(`${EDGES_BASE}/from/${encodeURIComponent(oid)}?${params.toString()}`);
}

export async function getEdgesTo(
    oid: string,
    edgeType?: string,
    includeObjects = true,
    effectiveAtFrom?: string,
    effectiveAtTo?: string
): Promise<GlobalEdgeListResponse> {
    const params = new URLSearchParams({ page_size: '100', include_objects: String(includeObjects) });
    if (edgeType) params.set('edge_type', edgeType);
    if (effectiveAtFrom) params.set('effective_at_from', effectiveAtFrom);
    if (effectiveAtTo) params.set('effective_at_to', effectiveAtTo);
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

// ============================================================================
// Activity APIs
// ============================================================================

function setOptionalQueryParam(query: URLSearchParams, key: string, value: string | number | undefined): void {
    if (value === undefined) return;
    const normalized = String(value).trim();
    if (normalized.length === 0) return;
    query.set(key, normalized);
}

export async function getIncidents(): Promise<Incident[]> {
    return fetchAllPages<Incident>(`${OBJECTS_BASE}/activities/incidents`);
}

export async function getIncidentsPage(params: IncidentListParams = {}): Promise<IncidentListResponse> {
    const queryParams = new URLSearchParams();
    setOptionalQueryParam(queryParams, 'state', params.state);
    setOptionalQueryParam(queryParams, 'priority', params.priority);
    setOptionalQueryParam(queryParams, 'stable_id', params.stable_id);
    setOptionalQueryParam(queryParams, 'actor_oid', params.actor_oid);
    setOptionalQueryParam(queryParams, 'created_at_from', params.created_at_from);
    setOptionalQueryParam(queryParams, 'created_at_to', params.created_at_to);
    setOptionalQueryParam(queryParams, 'updated_at_from', params.updated_at_from);
    setOptionalQueryParam(queryParams, 'updated_at_to', params.updated_at_to);
    setOptionalQueryParam(queryParams, 'effective_at_from', params.effective_at_from);
    setOptionalQueryParam(queryParams, 'effective_at_to', params.effective_at_to);
    if (params.skip !== undefined) queryParams.set('skip', String(params.skip));
    if (params.limit !== undefined) queryParams.set('limit', String(params.limit));

    const queryString = queryParams.toString();
    const url = `${OBJECTS_BASE}/activities/incidents${queryString ? `?${queryString}` : ''}`;
    return fetchApi<IncidentListResponse>(url);
}

export async function getIncident(oid: string): Promise<Incident> {
    return fetchApi<Incident>(`${OBJECTS_BASE}/activities/incidents/${encodeURIComponent(oid)}`);
}

export async function getRequests(): Promise<Request[]> {
    return fetchAllPages<Request>(`${OBJECTS_BASE}/activities/requests`);
}

export async function getRequestsPage(params: RequestListParams = {}): Promise<RequestListResponse> {
    const queryParams = new URLSearchParams();
    setOptionalQueryParam(queryParams, 'state', params.state);
    setOptionalQueryParam(queryParams, 'priority', params.priority);
    setOptionalQueryParam(queryParams, 'stable_id', params.stable_id);
    setOptionalQueryParam(queryParams, 'actor_oid', params.actor_oid);
    setOptionalQueryParam(queryParams, 'created_at_from', params.created_at_from);
    setOptionalQueryParam(queryParams, 'created_at_to', params.created_at_to);
    setOptionalQueryParam(queryParams, 'updated_at_from', params.updated_at_from);
    setOptionalQueryParam(queryParams, 'updated_at_to', params.updated_at_to);
    setOptionalQueryParam(queryParams, 'effective_at_from', params.effective_at_from);
    setOptionalQueryParam(queryParams, 'effective_at_to', params.effective_at_to);
    if (params.skip !== undefined) queryParams.set('skip', String(params.skip));
    if (params.limit !== undefined) queryParams.set('limit', String(params.limit));

    const queryString = queryParams.toString();
    const url = `${OBJECTS_BASE}/activities/requests${queryString ? `?${queryString}` : ''}`;
    return fetchApi<RequestListResponse>(url);
}

export async function getRequest(oid: string): Promise<Request> {
    return fetchApi<Request>(`${OBJECTS_BASE}/activities/requests/${encodeURIComponent(oid)}`);
}

export async function getInquiries(): Promise<Inquiry[]> {
    return fetchAllPages<Inquiry>(`${OBJECTS_BASE}/activities/inquiries`);
}

export async function getInquiriesPage(params: InquiryListParams = {}): Promise<InquiryListResponse> {
    const queryParams = new URLSearchParams();
    setOptionalQueryParam(queryParams, 'state', params.state);
    setOptionalQueryParam(queryParams, 'actor_oid', params.actor_oid);
    setOptionalQueryParam(queryParams, 'created_at_from', params.created_at_from);
    setOptionalQueryParam(queryParams, 'created_at_to', params.created_at_to);
    setOptionalQueryParam(queryParams, 'updated_at_from', params.updated_at_from);
    setOptionalQueryParam(queryParams, 'updated_at_to', params.updated_at_to);
    setOptionalQueryParam(queryParams, 'effective_at_from', params.effective_at_from);
    setOptionalQueryParam(queryParams, 'effective_at_to', params.effective_at_to);
    if (params.skip !== undefined) queryParams.set('skip', String(params.skip));
    if (params.limit !== undefined) queryParams.set('limit', String(params.limit));

    const queryString = queryParams.toString();
    const url = `${OBJECTS_BASE}/activities/inquiries${queryString ? `?${queryString}` : ''}`;
    return fetchApi<InquiryListResponse>(url);
}


export async function getInquiry(oid: string): Promise<Inquiry> {
    return fetchApi<Inquiry>(`${OBJECTS_BASE}/activities/inquiries/${encodeURIComponent(oid)}`);
}

export async function getInteractions(params: InteractionListParams = {}): Promise<InteractionListResponse> {
    const queryParams = new URLSearchParams();

    if (params.stable_id) queryParams.set('stable_id', params.stable_id);
    if (params.stable_id_prefix) queryParams.set('stable_id_prefix', params.stable_id_prefix);
    if (params.actor_stable_id) queryParams.set('actor_stable_id', params.actor_stable_id);
    if (params.source_system) queryParams.set('source_system', params.source_system);
    if (params.assignment_status !== undefined) queryParams.set('assignment_status', params.assignment_status);
    if (params.assigned_inquiry_oid) queryParams.set('assigned_inquiry_oid', params.assigned_inquiry_oid);
    if (params.created_at_from) queryParams.set('created_at_from', params.created_at_from);
    if (params.created_at_to) queryParams.set('created_at_to', params.created_at_to);
    if (params.skip !== undefined) queryParams.set('skip', String(params.skip));
    if (params.limit !== undefined) queryParams.set('limit', String(params.limit));
    if (params.sort_by) queryParams.set('sort_by', params.sort_by);
    if (params.order) queryParams.set('order', params.order);

    const queryString = queryParams.toString();
    const url = `${OBJECTS_BASE}/activities/interactions${queryString ? `?${queryString}` : ''}`;
    return fetchApi<InteractionListResponse>(url);
}

export async function getAllInteractions(
    params: Omit<InteractionListParams, 'skip' | 'limit'> = {}
): Promise<Interaction[]> {
    const allResults: Interaction[] = [];
    const seenOids = new Set<string>();
    let skip = 0;
    let pageCount = 0;
    let consecutiveDuplicatePages = 0;

    while (pageCount < MAX_PAGES) {
        const response = await getInteractions({
            ...params,
            skip,
            limit: PAGE_SIZE,
        });

        const newItems = response.items.filter(item => !seenOids.has(item.oid));
        newItems.forEach(item => {
            seenOids.add(item.oid);
            allResults.push(item);
        });

        if (newItems.length === 0 && response.items.length > 0) {
            consecutiveDuplicatePages++;
            if (consecutiveDuplicatePages >= 3) {
                console.warn(`[getAllInteractions] 3+ consecutive duplicate pages at skip=${skip}. Stopping.`);
                break;
            }
        } else {
            consecutiveDuplicatePages = 0;
        }

        if (response.items.length < PAGE_SIZE) {
            break;
        }
        skip += PAGE_SIZE;
        pageCount++;
    }

    console.log(`[getAllInteractions] Fetched ${allResults.length} unique items in ${pageCount + 1} pages.`);
    return allResults;
}

export async function getInteraction(oid: string): Promise<Interaction> {
    return fetchApi<Interaction>(`${OBJECTS_BASE}/activities/interactions/${encodeURIComponent(oid)}`);
}

export async function createIncident(data: IncidentCreate): Promise<Incident> {
    return fetchApi<Incident>(`${OBJECTS_BASE}/activities/incidents`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function updateIncident(oid: string, data: IncidentUpdate): Promise<Incident> {
    return fetchApi<Incident>(`${OBJECTS_BASE}/activities/incidents/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function deleteIncident(oid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/activities/incidents/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

export async function createRequest(data: RequestCreate): Promise<Request> {
    return fetchApi<Request>(`${OBJECTS_BASE}/activities/requests`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function updateRequest(oid: string, data: RequestUpdate): Promise<Request> {
    return fetchApi<Request>(`${OBJECTS_BASE}/activities/requests/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function deleteRequest(oid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/activities/requests/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

export async function createInquiry(data: InquiryCreate): Promise<Inquiry> {
    return fetchApi<Inquiry>(`${OBJECTS_BASE}/activities/inquiries`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function updateInquiry(oid: string, data: InquiryUpdate): Promise<Inquiry> {
    return fetchApi<Inquiry>(`${OBJECTS_BASE}/activities/inquiries/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function deleteInquiry(oid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/activities/inquiries/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

export async function deleteInteraction(oid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/activities/interactions/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}
