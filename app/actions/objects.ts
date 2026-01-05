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
import { logger } from '@/lib/logger';

// ============================================================================
// Organization Actions
// ============================================================================

export async function createOrganizationAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createOrganization';
    const startTime = Date.now();

    const name = formData.get('name') as string;
    const type = formData.get('type') as 'Top Level' | 'Business Group' | 'Line' | 'Department' | 'Center' | 'Team';
    const stableId = formData.get('stable_id') as string | null;
    const parentOid = formData.get('parent_oid') as string | null;

    logger.info(`Started`, { requestId, action });

    try {
        const result = await createOrganization({
            name,
            type,
            stable_id: stableId || null,
            parent_oid: parentOid || null,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateOrganizationAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateOrganization';
    const startTime = Date.now();

    const name = formData.get('name') as string | null;
    const type = formData.get('type') as 'Top Level' | 'Business Group' | 'Line' | 'Department' | 'Center' | 'Team' | null;
    const stableId = formData.get('stable_id') as string | null;
    const parentOid = formData.get('parent_oid') as string | null;

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await updateOrganization(oid, {
            name: name || undefined,
            type: type || undefined,
            stable_id: stableId,
            parent_oid: parentOid,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteOrganizationAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteOrganization';
    const startTime = Date.now();

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await deleteOrganization(oid);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

// ============================================================================
// Location Actions
// ============================================================================

export async function createLocationAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createLocation';
    const startTime = Date.now();

    const name = formData.get('name') as string;
    const parentOid = formData.get('parent_oid') as string | null;
    const type = formData.get('type') as 'Root' | 'Region' | 'Country' | 'Office Location' | 'Remote Location';
    const timezone = formData.get('timezone') as string;
    const stableId = formData.get('stable_id') as string | null;

    logger.info(`Started`, { requestId, action });

    try {
        const result = await createLocation({
            name,
            type,
            timezone,
            stable_id: stableId || null,
            parent_oid: parentOid || null,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateLocationAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateLocation';
    const startTime = Date.now();

    const name = formData.get('name') as string | null;
    const parentOid = formData.get('parent_oid') as string | null;
    const type = formData.get('type') as 'Root' | 'Region' | 'Country' | 'Office Location' | 'Remote Location' | null;
    const timezone = formData.get('timezone') as string | null;
    const stableId = formData.get('stable_id') as string | null;

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await updateLocation(oid, {
            name: name || undefined,
            type: type || undefined,
            timezone: timezone !== null ? timezone : undefined,
            stable_id: stableId,
            parent_oid: parentOid,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteLocationAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteLocation';
    const startTime = Date.now();

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await deleteLocation(oid);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

// ============================================================================
// Worker Actions
// ============================================================================

export async function createWorkerAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createWorker';
    const startTime = Date.now();

    const fullName = formData.get('full_name') as string;
    const workerId = formData.get('worker_id') as string | null;
    const email = formData.get('email') as string | null;
    const orgOid = formData.get('org_oid') as string;
    const locationOid = formData.get('location_oid') as string | null;
    const managerOid = formData.get('manager_oid') as string | null;
    const isActive = formData.get('is_active') === 'true';

    logger.info(`Started`, { requestId, action });

    try {
        const result = await createWorker({
            full_name: fullName,
            worker_id: workerId || null,
            email: email || null,
            org_oid: orgOid,
            location_oid: locationOid || null,
            manager_oid: managerOid || null,
            is_active: isActive,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateWorkerAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateWorker';
    const startTime = Date.now();

    const fullName = formData.get('full_name') as string | null;
    const workerId = formData.get('worker_id') as string | null;
    const email = formData.get('email') as string | null;
    const orgOid = formData.get('org_oid') as string | null;
    const locationOid = formData.get('location_oid') as string | null;
    const managerOid = formData.get('manager_oid') as string | null;
    const isActiveStr = formData.get('is_active');

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await updateWorker(oid, {
            full_name: fullName || undefined,
            worker_id: workerId,
            email: email,
            org_oid: orgOid || undefined,
            location_oid: locationOid === '' ? '' : (locationOid || undefined),
            manager_oid: managerOid,
            is_active: isActiveStr !== null ? isActiveStr === 'true' : undefined,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteWorkerAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteWorker';
    const startTime = Date.now();

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await deleteWorker(oid);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

// ============================================================================
// Ticket Actions
// ============================================================================

export async function createTicketAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createTicket';
    const startTime = Date.now();

    const title = formData.get('title') as string;
    const orgOid = formData.get('org_oid') as string;
    const status = formData.get('status') as string | null;

    logger.info(`Started`, { requestId, action });

    try {
        const result = await createTicket({
            title,
            org_oid: orgOid,
            status: status || undefined,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateTicketAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateTicket';
    const startTime = Date.now();

    const title = formData.get('title') as string | null;
    const status = formData.get('status') as string | null;

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await updateTicket(oid, {
            title: title || undefined,
            status: status || undefined,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteTicketAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteTicket';
    const startTime = Date.now();

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await deleteTicket(oid);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

// ============================================================================
// Worker-Hierarchy-Role Actions
// ============================================================================

export async function assignWorkerRoleAction(workerOid: string, roleOid: string, hierarchyOid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:assignWorkerRole';
    const startTime = Date.now();

    logger.info(`Started`, { requestId, action });

    try {
        const result = await assignWorkerHierarchyRole({
            worker_oid: workerOid,
            role_oid: roleOid,
            hierarchy_oid: hierarchyOid,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function removeWorkerRoleAction(workerOid: string, roleOid: string, hierarchyOid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:removeWorkerRole';
    const startTime = Date.now();

    logger.info(`Started`, { requestId, action });

    try {
        const result = await removeWorkerHierarchyRole(workerOid, roleOid, hierarchyOid);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}
