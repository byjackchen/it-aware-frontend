'use server';

/**
 * Server actions for the Data module.
 */

import {
    createOrganization,
    updateOrganization,
    deleteOrganization,
    createLocation,
    updateLocation,
    deleteLocation,
    createWorker,
    updateWorker,
    deleteWorker,
    createTicket,
    updateTicket,
    deleteTicket,
    assignWorkerHierarchyRole,
    removeWorkerHierarchyRole,
} from '@/lib/api/objects';

// ============================================================================
// Organization Actions
// ============================================================================

export async function createOrganizationAction(formData: FormData) {
    const name = formData.get('name') as string;
    const type = formData.get('type') as 'Top Level' | 'Business Group' | 'Line' | 'Department' | 'Center' | 'Team';
    const stableId = formData.get('stable_id') as string | null;
    const parentOid = formData.get('parent_oid') as string | null;

    return createOrganization({
        name,
        type,
        stable_id: stableId || null,
        parent_oid: parentOid || null,
    });
}

export async function updateOrganizationAction(oid: string, formData: FormData) {
    const name = formData.get('name') as string | null;
    const type = formData.get('type') as 'Top Level' | 'Business Group' | 'Line' | 'Department' | 'Center' | 'Team' | null;
    const stableId = formData.get('stable_id') as string | null;
    const parentOid = formData.get('parent_oid') as string | null;

    return updateOrganization(oid, {
        name: name || undefined,
        type: type || undefined,
        stable_id: stableId,
        parent_oid: parentOid,
    });
}

export async function deleteOrganizationAction(oid: string) {
    return deleteOrganization(oid);
}

// ============================================================================
// Location Actions
// ============================================================================

export async function createLocationAction(formData: FormData) {
    const name = formData.get('name') as string;
    const parentOid = formData.get('parent_oid') as string | null;
    const type = formData.get('type') as 'root' | 'region' | 'country' | 'office_location' | 'remote_location';
    const timezone = formData.get('timezone') as string;
    const stableId = formData.get('stable_id') as string | null;

    return createLocation({
        name,
        type,
        timezone,
        stable_id: stableId || null,
        parent_oid: parentOid || null,
    });
}

export async function updateLocationAction(oid: string, formData: FormData) {
    const name = formData.get('name') as string | null;
    const parentOid = formData.get('parent_oid') as string | null;
    const type = formData.get('type') as 'root' | 'region' | 'country' | 'office_location' | 'remote_location' | null;
    const timezone = formData.get('timezone') as string | null;
    const stableId = formData.get('stable_id') as string | null;

    return updateLocation(oid, {
        name: name || undefined,
        type: type || undefined,
        timezone: timezone !== null ? timezone : undefined,
        stable_id: stableId,
        parent_oid: parentOid,
    });
}

export async function deleteLocationAction(oid: string) {
    return deleteLocation(oid);
}

// ============================================================================
// Worker Actions
// ============================================================================

export async function createWorkerAction(formData: FormData) {
    const fullName = formData.get('full_name') as string;
    const workerId = formData.get('worker_id') as string | null;
    const email = formData.get('email') as string | null;
    const orgOid = formData.get('org_oid') as string;
    const locationOid = formData.get('location_oid') as string | null;
    const managerOid = formData.get('manager_oid') as string | null;
    const isActive = formData.get('is_active') === 'true';

    return createWorker({
        full_name: fullName,
        worker_id: workerId || null,
        email: email || null,
        org_oid: orgOid,
        location_oid: locationOid || null,
        manager_oid: managerOid || null,
        is_active: isActive,
    });
}

export async function updateWorkerAction(oid: string, formData: FormData) {
    const fullName = formData.get('full_name') as string | null;
    const workerId = formData.get('worker_id') as string | null;
    const email = formData.get('email') as string | null;
    const orgOid = formData.get('org_oid') as string | null;
    const locationOid = formData.get('location_oid') as string | null;
    const managerOid = formData.get('manager_oid') as string | null;
    const isActiveStr = formData.get('is_active');

    return updateWorker(oid, {
        full_name: fullName || undefined,
        worker_id: workerId,
        email: email,
        org_oid: orgOid || undefined,
        location_oid: locationOid === '' ? '' : (locationOid || undefined),
        manager_oid: managerOid,
        is_active: isActiveStr !== null ? isActiveStr === 'true' : undefined,
    });
}

export async function deleteWorkerAction(oid: string) {
    return deleteWorker(oid);
}

// ============================================================================
// Ticket Actions
// ============================================================================

export async function createTicketAction(formData: FormData) {
    const title = formData.get('title') as string;
    const orgOid = formData.get('org_oid') as string;
    const status = formData.get('status') as string | null;

    return createTicket({
        title,
        org_oid: orgOid,
        status: status || undefined,
    });
}

export async function updateTicketAction(oid: string, formData: FormData) {
    const title = formData.get('title') as string | null;
    const status = formData.get('status') as string | null;

    return updateTicket(oid, {
        title: title || undefined,
        status: status || undefined,
    });
}

export async function deleteTicketAction(oid: string) {
    return deleteTicket(oid);
}

// ============================================================================
// Worker-Hierarchy-Role Actions
// ============================================================================

export async function assignWorkerRoleAction(workerOid: string, roleOid: string, hierarchyOid: string) {
    return assignWorkerHierarchyRole({
        worker_oid: workerOid,
        role_oid: roleOid,
        hierarchy_oid: hierarchyOid,
    });
}

export async function removeWorkerRoleAction(workerOid: string, roleOid: string, hierarchyOid: string) {
    return removeWorkerHierarchyRole(workerOid, roleOid, hierarchyOid);
}
