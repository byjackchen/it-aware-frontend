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
    createServiceCatalog,
    updateServiceCatalog,
    deleteServiceCatalog,
    createWorker,
    updateWorker,
    deleteWorker,
    createTicket,
    updateTicket,
    deleteTicket,
    createArticle,
    updateArticle,
    deleteArticle,
    assignWorkerHierarchyRole,
    removeWorkerHierarchyRole,
    createIncident,
    updateIncident,
    deleteIncident,
    createInquiry,
    updateInquiry,
    deleteInquiry,
} from '@/lib/api/objects';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

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
    const isActiveStr = formData.get('is_active');
    const metadataStr = formData.get('metadata') as string | null;

    logger.info(`Started`, {
        requestId,
        action,
        payload: { name, type, stableId, parentOid, isActive: isActiveStr, hasMetadata: !!metadataStr }
    });

    // Parse metadata JSON
    let metadata: Record<string, unknown> | null = null;
    if (metadataStr && metadataStr.trim()) {
        try {
            metadata = JSON.parse(metadataStr);
        } catch (e) {
            logger.error(`Invalid metadata JSON`, e, { requestId, action });
            throw new Error('Invalid metadata JSON format');
        }
    }

    try {
        const result = await createOrganization({
            name,
            type,
            stable_id: stableId || null,
            parent_oid: parentOid || null,
            is_active: isActiveStr !== null ? isActiveStr === 'true' : undefined,
            metadata,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, {
            requestId,
            action,
            payload: { name, type }
        });
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
    const isActiveStr = formData.get('is_active');
    const metadataStr = formData.get('metadata') as string | null;

    logger.info(`Started - oid: ${oid}`, {
        requestId,
        action,
        payload: { oid, name, type, stableId, parentOid, isActive: isActiveStr, hasMetadata: metadataStr !== null }
    });

    // Parse metadata JSON - empty string means clear metadata
    let metadata: Record<string, unknown> | null | undefined = undefined;
    if (metadataStr !== null) {
        if (metadataStr.trim() === '') {
            metadata = null; // Clear metadata
        } else {
            try {
                metadata = JSON.parse(metadataStr);
            } catch (e) {
                logger.error(`Invalid metadata JSON`, e, { requestId, action });
                throw new Error('Invalid metadata JSON format');
            }
        }
    }

    try {
        const result = await updateOrganization(oid, {
            name: name || undefined,
            type: type || undefined,
            stable_id: stableId,
            parent_oid: parentOid,
            is_active: isActiveStr !== null ? isActiveStr === 'true' : undefined,
            metadata,
        });
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, {
            requestId,
            action,
            payload: { oid }
        });
        throw error;
    }
}

export async function deleteOrganizationAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteOrganization';
    const startTime = Date.now();

    logger.info(`Started - oid: ${oid}`, { requestId, action, payload: { oid } });

    try {
        const result = await deleteOrganization(oid);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, {
            requestId,
            action,
            payload: { oid }
        });
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
    const type = formData.get('type') as 'root' | 'region' | 'country' | 'office_location' | 'remote_location';
    const timezone = formData.get('timezone') as string;
    const stableId = formData.get('stable_id') as string | null;
    const isActiveStr = formData.get('is_active');

    logger.info(`Started`, { requestId, action });

    try {
        const result = await createLocation({
            name,
            type,
            timezone,
            stable_id: stableId || null,
            parent_oid: parentOid || null,
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

export async function updateLocationAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateLocation';
    const startTime = Date.now();

    const name = formData.get('name') as string | null;
    const parentOid = formData.get('parent_oid') as string | null;
    const type = formData.get('type') as 'root' | 'region' | 'country' | 'office_location' | 'remote_location' | null;
    const timezone = formData.get('timezone') as string | null;
    const stableId = formData.get('stable_id') as string | null;
    const isActiveStr = formData.get('is_active');

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await updateLocation(oid, {
            name: name || undefined,
            type: type || undefined,
            timezone: timezone !== null ? timezone : undefined,
            stable_id: stableId,
            parent_oid: parentOid,
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
// Service Catalog Actions
// ============================================================================

export async function createServiceCatalogAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createServiceCatalog';
    const startTime = Date.now();

    const name = formData.get('name') as string;
    const stableId = formData.get('stable_id') as string | null;
    const parentOid = formData.get('parent_oid') as string | null;
    const isActiveStr = formData.get('is_active');

    logger.info(`Started`, { requestId, action });

    try {
        const result = await createServiceCatalog({
            name,
            stable_id: stableId || null,
            parent_oid: parentOid || null,
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

export async function updateServiceCatalogAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateServiceCatalog';
    const startTime = Date.now();

    const name = formData.get('name') as string | null;
    const stableId = formData.get('stable_id') as string | null;
    const parentOid = formData.get('parent_oid') as string | null;
    const isActiveStr = formData.get('is_active');

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await updateServiceCatalog(oid, {
            name: name || undefined,
            stable_id: stableId,
            parent_oid: parentOid,
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

export async function deleteServiceCatalogAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteServiceCatalog';
    const startTime = Date.now();

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await deleteServiceCatalog(oid);
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

    const stableId = formData.get('stable_id') as string;
    const fullname = formData.get('fullname') as string;
    const workerId = formData.get('worker_id') as string | null;
    const email = formData.get('email') as string | null;
    const gender = formData.get('gender') as string | null;
    const workerType = formData.get('worker_type') as string | null;
    const jobCategory = formData.get('job_category') as string | null;
    const jobSubcategory = formData.get('job_subcategory') as string | null;
    const jobProfessionalLevel = formData.get('job_professional_level') as string | null;
    const jobManagementLevel = formData.get('job_management_level') as string | null;
    const jobBand = formData.get('job_band') as string | null;
    const jobTitle = formData.get('job_title') as string | null;
    const orgOid = formData.get('org_oid') as string;
    const locationOid = formData.get('location_oid') as string | null;
    const managerOid = formData.get('manager_oid') as string | null;
    const isActiveStr = formData.get('is_active');

    logger.info(`Started`, { requestId, action });

    try {
        const result = await createWorker({
            stable_id: stableId,
            fullname: fullname,
            worker_id: workerId || null,
            email: email || null,
            gender: gender || null,
            worker_type: workerType || null,
            job_category: jobCategory || null,
            job_subcategory: jobSubcategory || null,
            job_professional_level: jobProfessionalLevel || null,
            job_management_level: jobManagementLevel || null,
            job_band: jobBand || null,
            job_title: jobTitle || null,
            org_oid: orgOid,
            location_oid: locationOid || null,
            manager_oid: managerOid || null,
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

export async function updateWorkerAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateWorker';
    const startTime = Date.now();

    const stableId = formData.get('stable_id') as string | null;
    const fullname = formData.get('fullname') as string | null;
    const workerId = formData.get('worker_id') as string | null;
    const email = formData.get('email') as string | null;
    const gender = formData.get('gender') as string | null;
    const workerType = formData.get('worker_type') as string | null;
    const jobCategory = formData.get('job_category') as string | null;
    const jobSubcategory = formData.get('job_subcategory') as string | null;
    const jobProfessionalLevel = formData.get('job_professional_level') as string | null;
    const jobManagementLevel = formData.get('job_management_level') as string | null;
    const jobBand = formData.get('job_band') as string | null;
    const jobTitle = formData.get('job_title') as string | null;
    const orgOid = formData.get('org_oid') as string | null;
    const locationOid = formData.get('location_oid') as string | null;
    const managerOid = formData.get('manager_oid') as string | null;
    const isActiveStr = formData.get('is_active');

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await updateWorker(oid, {
            stable_id: stableId || undefined,
            fullname: fullname || undefined,
            worker_id: workerId,
            email: email,
            gender: gender,
            worker_type: workerType,
            job_category: jobCategory,
            job_subcategory: jobSubcategory,
            job_professional_level: jobProfessionalLevel,
            job_management_level: jobManagementLevel,
            job_band: jobBand,
            job_title: jobTitle,
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
    // const orgOid = formData.get('org_oid') as string; // Removed
    const requesterOid = formData.get('requester_oid') as string | null;
    const status = formData.get('status') as string | null;
    const isActiveStr = formData.get('is_active');

    logger.info(`Started`, { requestId, action });

    try {
        const result = await createTicket({
            title,
            // org_oid: orgOid,
            requester_oid: requesterOid || undefined,
            status: status || undefined,
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

export async function updateTicketAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateTicket';
    const startTime = Date.now();

    const title = formData.get('title') as string | null;
    const status = formData.get('status') as string | null;
    const isActiveStr = formData.get('is_active');

    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const result = await updateTicket(oid, {
            title: title || undefined,
            status: status || undefined,
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

// ============================================================================
// Article Actions
// ============================================================================

export async function createArticleAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createArticle';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const service_catalog_id = formData.get('service_catalog_id') as string;
    const title = formData.get('title') as string;
    const markdown = formData.get('markdown') as string;
    const stable_id = formData.get('stable_id') as string | null;
    const summary = formData.get('summary') as string | null;
    const source_system = formData.get('source_system') as string | null;
    const source_url = formData.get('source_url') as string | null;
    const is_active = formData.get('is_active') === 'true';

    try {
        await createArticle({
            service_catalog_id,
            title,
            markdown,
            stable_id: stable_id || undefined,
            summary: summary || undefined,
            source_system: source_system || undefined,
            source_url: source_url || undefined,
            is_active,
        });
        revalidatePath('/data/articles');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateArticleAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateArticle';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const title = formData.get('title') as string;
    const markdown = formData.get('markdown') as string;
    const summary = formData.get('summary') as string | null;
    const source_system = formData.get('source_system') as string | null;
    const source_url = formData.get('source_url') as string | null;
    const is_active_str = formData.get('is_active');

    // Only include is_active if it's present in the form data
    const is_active = is_active_str !== null ? is_active_str === 'true' : undefined;

    try {
        await updateArticle(oid, {
            title,
            markdown,
            summary: summary || undefined,
            source_system: source_system || undefined,
            source_url: source_url || undefined,
            is_active,
        });
        revalidatePath('/data/articles');
        revalidatePath(`/data/articles/${oid}`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteArticleAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteArticle';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    try {
        await deleteArticle(oid);
        revalidatePath('/data/articles');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

// ============================================================================
// Activity Actions (Incidents & Inquiries)
// ============================================================================

export async function createIncidentAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createIncident';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const priority = formData.get('priority') as string | null;
    const urgency = formData.get('urgency') as string | null;
    const channel = formData.get('channel') as string | null;
    const assigned_to_oid = formData.get('assigned_to_oid') as string | null;
    const service_catalog_oid = formData.get('service_catalog_oid') as string | null;
    const assigned_group = formData.get('assigned_group') as string | null;
    const fact = formData.get('fact') as string | null;

    try {
        await createIncident({
            title,
            description: description || undefined,
            priority: priority || undefined,
            urgency: urgency || undefined,
            channel: channel || undefined,
            assigned_to_oid: assigned_to_oid || undefined,
            service_catalog_oid: service_catalog_oid || undefined,
            assigned_group: assigned_group || undefined,
            fact: fact || undefined,
        });
        revalidatePath('/data/incidents');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateIncidentAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateIncident';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const priority = formData.get('priority') as string | null;
    const urgency = formData.get('urgency') as string | null;
    const channel = formData.get('channel') as string | null;
    const assigned_to_oid = formData.get('assigned_to_oid') as string | null;
    const service_catalog_oid = formData.get('service_catalog_oid') as string | null;
    const assigned_group = formData.get('assigned_group') as string | null;
    const fact = formData.get('fact') as string | null;
    const state = formData.get('state') as string | null;

    try {
        await updateIncident(oid, {
            title,
            description: description || undefined,
            priority: priority || undefined,
            urgency: urgency || undefined,
            channel: channel || undefined,
            assigned_to_oid: assigned_to_oid || undefined,
            service_catalog_oid: service_catalog_oid || undefined,
            assigned_group: assigned_group || undefined,
            fact: fact || undefined,
            state: state || undefined,
        });
        revalidatePath('/data/incidents');
        revalidatePath(`/data/incidents/${oid}`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteIncidentAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteIncident';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    try {
        await deleteIncident(oid);
        revalidatePath('/data/incidents');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function createInquiryAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createInquiry';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const topic = formData.get('topic') as string | null;
    const fact = formData.get('fact') as string | null;
    const messagesStr = formData.get('messages') as string | null;

    let messages: any[] | undefined = undefined;
    if (messagesStr) {
        try {
            messages = JSON.parse(messagesStr);
        } catch (e) {
             logger.error(`Invalid messages JSON`, e, { requestId, action });
             throw new Error('Invalid messages JSON format');
        }
    }

    try {
        await createInquiry({
            topic: topic || undefined,
            fact: fact || undefined,
            messages,
        });
        revalidatePath('/data/inquiries');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateInquiryAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateInquiry';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const topic = formData.get('topic') as string | null;
    const fact = formData.get('fact') as string | null;
    const state = formData.get('state') as string | null;
    const messagesStr = formData.get('messages') as string | null;

    let messages: any[] | undefined = undefined;
    if (messagesStr) {
        try {
            messages = JSON.parse(messagesStr);
        } catch (e) {
             logger.error(`Invalid messages JSON`, e, { requestId, action });
             throw new Error('Invalid messages JSON format');
        }
    }

    try {
        await updateInquiry(oid, {
            topic: topic || undefined,
            fact: fact || undefined,
            state: state || undefined,
            messages,
        });
        revalidatePath('/data/inquiries');
        revalidatePath(`/data/inquiries/${oid}`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteInquiryAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteInquiry';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    try {
        await deleteInquiry(oid);
        revalidatePath('/data/inquiries');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}
