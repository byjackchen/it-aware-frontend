/**
 * Server-side API client for Objects module (organizations, locations, workers, tickets).
 * Also includes edges and worker-hierarchy-role APIs.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type {
    Organization,
    OrganizationCreate,
    OrganizationUpdate,
    Location,
    LocationCreate,
    LocationUpdate,
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
} from '@/lib/types/objects';
import type { Role } from '@/lib/types/security';

const OBJECTS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects`;
const HIERARCHIES_BASE = `${RUNTIME_CONFIG.backend.domain}/hierarchies`;
const EDGES_BASE = `${RUNTIME_CONFIG.backend.domain}/edges`;
const AUTH_CONFIG_BASE = `${RUNTIME_CONFIG.backend.domain}/auth/config`;

// ============================================================================
// Core API Fetch Function
// ============================================================================

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            ...options?.headers,
        },
        cache: 'no-store',
    });

    if (res.status === 401) {
        redirect('/login');
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(error.detail || `API Error: ${res.status}`);
    }

    if (res.status === 204) {
        return null as T;
    }

    return res.json();
}

// ============================================================================
// Organization APIs
// ============================================================================

export async function getOrganizations(): Promise<Organization[]> {
    return fetchApi<Organization[]>(`${HIERARCHIES_BASE}/organizations?limit=1000`);
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
    return fetchApi<Location[]>(`${HIERARCHIES_BASE}/locations?limit=1000`);
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
// Worker APIs
// ============================================================================

export async function getWorkers(isActive?: boolean): Promise<Worker[]> {
    const params = new URLSearchParams({ limit: '1000' });
    if (isActive !== undefined) {
        params.set('is_active', String(isActive));
    }
    return fetchApi<Worker[]>(`${OBJECTS_BASE}/workers?${params.toString()}`);
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
