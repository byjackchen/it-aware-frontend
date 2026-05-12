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
    upsertWorkerProfile,
    createArticle,
    updateArticle,
    deleteArticle,
    assignWorkerHierarchyRole,
    removeWorkerHierarchyRole,
    createIncident,
    updateIncident,
    deleteIncident,
    createRequest,
    updateRequest,
    deleteRequest,
    deleteInteraction,
    createAgent,
    updateAgent,
    deleteAgent,
    createSystem,
    updateSystem,
    deleteSystem,
    createTicket,
    updateTicket,
    deleteTicket,
} from '@/lib/api/objects';
import {
    createAnalysis,
    updateAnalysis,
    deleteAnalysis,
} from '@/lib/api/insights';
import {
    createScenario,
    updateScenario,
    deleteScenario,
} from '@/lib/api/scenarios';
import type { WorkerProfile, WorkerProfileUpsert } from '@/lib/types/objects';
import {
    linkAccountAgent,
    unlinkAccountAgent,
    linkAccountSystem,
    unlinkAccountSystem,
} from '@/lib/api/security';
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
    const isVipStr = formData.get('is_vip');
    const vipType = formData.get('vip_type') as string | null;
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
            is_vip: isVipStr !== null ? isVipStr === 'true' : undefined,
            vip_type: vipType !== null ? (vipType.trim() || null) : undefined,
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
    const isVipStr = formData.get('is_vip');
    const vipType = formData.get('vip_type') as string | null;
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
            is_vip: isVipStr !== null ? isVipStr === 'true' : undefined,
            vip_type: vipType !== null ? (vipType.trim() || null) : undefined,
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

export async function upsertWorkerProfileAction(workerOid: string, payload: WorkerProfileUpsert): Promise<WorkerProfile> {
    const requestId = logger.generateRequestId();
    const action = 'Objects:upsertWorkerProfile';
    const startTime = Date.now();

    logger.info(`Started - worker_oid: ${workerOid}`, {
        requestId,
        action,
        payload: {
            hasSummary: payload.summary !== undefined,
            hasTopics: payload.topics !== undefined,
            hasTags: payload.tags !== undefined,
        },
    });

    if (payload.summary === undefined && payload.topics === undefined && payload.tags === undefined) {
        throw new Error('At least one of summary/topics/tags must be provided');
    }

    try {
        const result = await upsertWorkerProfile(workerOid, payload);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return result;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, {
            requestId,
            action,
            payload: { workerOid },
        });
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
    const stableIdRaw = formData.get('stable_id');
    const stable_id = stableIdRaw !== null ? String(stableIdRaw).trim() : null;
    const summary = formData.get('summary') as string | null;
    const source_system = formData.get('source_system') as string | null;
    const source_url = formData.get('source_url') as string | null;
    const is_active = formData.get('is_active') === 'true';

    try {
        await createArticle({
            service_catalog_id,
            title,
            markdown,
            stable_id: stable_id ? stable_id : undefined,
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
// Activity Actions (Incidents, Requests)
// ============================================================================

export async function createIncidentAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createIncident';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const stableIdRaw = formData.get('stable_id');
    let stable_id: string | null | undefined = undefined;
    if (stableIdRaw !== null) {
        const trimmed = String(stableIdRaw).trim();
        stable_id = trimmed === '' ? null : trimmed;
    }
    const actor_oid = formData.get('actor_oid') as string;
    const actor_role = formData.get('actor_role') as string | null;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string | null;
    const priority = formData.get('priority') as string | null;
    const urgency = formData.get('urgency') as string | null;
    const category = formData.get('category') as string | null;
    const subcategory = formData.get('subcategory') as string | null;
    const impact = formData.get('impact') as string | null;
    const caller_name = formData.get('caller_name') as string | null;
    const assigned_to_name = formData.get('assigned_to_name') as string | null;
    const sn_id = formData.get('sn_id') as string | null;
    const channel = formData.get('channel') as string | null;
    const assigned_to_oid = formData.get('assigned_to_oid') as string | null;
    const service_catalog_oid = formData.get('service_catalog_oid') as string | null;
    const assigned_group = formData.get('assigned_group') as string | null;
    const configuration_item_oid = formData.get('configuration_item_oid') as string | null;
    const chat_transcripts_str = formData.get('chat_transcripts') as string | null;
    const source_system = formData.get('source_system') as string | null;
    const fact = formData.get('fact') as string | null;
    const created_at = formData.get('created_at') as string | null;
    const updated_at = formData.get('updated_at') as string | null;
    const effective_at = formData.get('effective_at') as string | null;

    let chat_transcripts: Record<string, unknown> | undefined = undefined;
    if (chat_transcripts_str) {
        try {
            chat_transcripts = JSON.parse(chat_transcripts_str);
        } catch (e) {
            logger.error(`Invalid chat_transcripts JSON`, e, { requestId, action });
            throw new Error('Invalid chat_transcripts JSON format');
        }
    }

    try {
        await createIncident({
            stable_id,
            actor_oid,
            actor_role: actor_role || undefined,
            title,
            description: description || undefined,
            priority: priority || undefined,
            urgency: urgency || undefined,
            category: category || undefined,
            subcategory: subcategory || undefined,
            impact: impact || undefined,
            caller_name: caller_name || undefined,
            assigned_to_name: assigned_to_name || undefined,
            sn_id: sn_id || undefined,
            channel: channel || undefined,
            assigned_to_oid: assigned_to_oid || undefined,
            service_catalog_oid: service_catalog_oid || undefined,
            assigned_group: assigned_group || undefined,
            configuration_item_oid: configuration_item_oid || undefined,
            chat_transcripts,
            source_system: source_system || undefined,
            fact: fact || undefined,
            created_at: created_at?.trim() || undefined,
            updated_at: updated_at?.trim() || undefined,
            effective_at: effective_at?.trim() || undefined,
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
    const stable_id = formData.get('stable_id') as string | null;
    const description = formData.get('description') as string | null;
    const priority = formData.get('priority') as string | null;
    const urgency = formData.get('urgency') as string | null;
    const category = formData.get('category') as string | null;
    const subcategory = formData.get('subcategory') as string | null;
    const impact = formData.get('impact') as string | null;
    const caller_name = formData.get('caller_name') as string | null;
    const assigned_to_name = formData.get('assigned_to_name') as string | null;
    const sn_id = formData.get('sn_id') as string | null;
    const channel = formData.get('channel') as string | null;
    const assigned_to_oid = formData.get('assigned_to_oid') as string | null;
    const service_catalog_oid = formData.get('service_catalog_oid') as string | null;
    const assigned_group = formData.get('assigned_group') as string | null;
    const configuration_item_oid = formData.get('configuration_item_oid') as string | null;
    const chat_transcripts_str = formData.get('chat_transcripts') as string | null;
    const source_system = formData.get('source_system') as string | null;
    const fact = formData.get('fact') as string | null;
    const state = formData.get('state') as string | null;
    const created_at = formData.get('created_at') as string | null;
    const updated_at = formData.get('updated_at') as string | null;
    const effective_at = formData.get('effective_at') as string | null;

    let chat_transcripts: Record<string, unknown> | undefined = undefined;
    if (chat_transcripts_str) {
        try {
            chat_transcripts = JSON.parse(chat_transcripts_str);
        } catch (e) {
            logger.error(`Invalid chat_transcripts JSON`, e, { requestId, action });
            throw new Error('Invalid chat_transcripts JSON format');
        }
    }

    try {
        await updateIncident(oid, {
            title,
            stable_id: stable_id || undefined,
            description: description || undefined,
            priority: priority || undefined,
            urgency: urgency || undefined,
            category: category || undefined,
            subcategory: subcategory || undefined,
            impact: impact || undefined,
            caller_name: caller_name || undefined,
            assigned_to_name: assigned_to_name || undefined,
            sn_id: sn_id || undefined,
            channel: channel || undefined,
            assigned_to_oid: assigned_to_oid || undefined,
            service_catalog_oid: service_catalog_oid || undefined,
            assigned_group: assigned_group || undefined,
            configuration_item_oid: configuration_item_oid || undefined,
            chat_transcripts,
            source_system: source_system || undefined,
            fact: fact || undefined,
            state: state || undefined,
            created_at: created_at?.trim() || undefined,
            updated_at: updated_at?.trim() || undefined,
            effective_at: effective_at?.trim() || undefined,
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

export async function createRequestAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createRequest';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const stableIdRaw = formData.get('stable_id');
    let stable_id: string | null | undefined = undefined;
    if (stableIdRaw !== null) {
        const trimmed = String(stableIdRaw).trim();
        stable_id = trimmed === '' ? null : trimmed;
    }
    const actor_oid = formData.get('actor_oid') as string;
    const actor_role = formData.get('actor_role') as string | null;
    const title = formData.get('title') as string;
    const state = (formData.get('state') as string | null)?.trim();
    const description = formData.get('description') as string | null;
    const priority = formData.get('priority') as string | null;
    const urgency = formData.get('urgency') as string | null;
    const item = formData.get('item') as string | null;
    const request_item = formData.get('request_item') as string | null;
    const caller_name = formData.get('caller_name') as string | null;
    const assigned_to_name = formData.get('assigned_to_name') as string | null;
    const sn_id = formData.get('sn_id') as string | null;
    const category = formData.get('category') as string | null;
    const subcategory = formData.get('subcategory') as string | null;
    const impact = formData.get('impact') as string | null;
    const channel = formData.get('channel') as string | null;
    const assigned_to_oid = formData.get('assigned_to_oid') as string | null;
    const service_catalog_oid = formData.get('service_catalog_oid') as string | null;
    const assigned_group = formData.get('assigned_group') as string | null;
    const configuration_item_oid = formData.get('configuration_item_oid') as string | null;
    const chat_transcripts_str = formData.get('chat_transcripts') as string | null;
    const source_system = formData.get('source_system') as string | null;
    const fact = formData.get('fact') as string | null;
    const created_at = formData.get('created_at') as string | null;
    const updated_at = formData.get('updated_at') as string | null;
    const effective_at = formData.get('effective_at') as string | null;

    let chat_transcripts: Record<string, unknown> | undefined = undefined;
    if (chat_transcripts_str) {
        try {
            chat_transcripts = JSON.parse(chat_transcripts_str);
        } catch (e) {
            logger.error(`Invalid chat_transcripts JSON`, e, { requestId, action });
            throw new Error('Invalid chat_transcripts JSON format');
        }
    }

    if (!state) {
        throw new Error('state is required');
    }

    try {
        await createRequest({
            stable_id,
            actor_oid,
            actor_role: actor_role || undefined,
            title,
            state,
            description: description || undefined,
            priority: priority || undefined,
            urgency: urgency || undefined,
            item: item || undefined,
            request_item: request_item || undefined,
            caller_name: caller_name || undefined,
            assigned_to_name: assigned_to_name || undefined,
            sn_id: sn_id || undefined,
            category: category || undefined,
            subcategory: subcategory || undefined,
            impact: impact || undefined,
            channel: channel || undefined,
            assigned_to_oid: assigned_to_oid || undefined,
            service_catalog_oid: service_catalog_oid || undefined,
            assigned_group: assigned_group || undefined,
            configuration_item_oid: configuration_item_oid || undefined,
            chat_transcripts,
            source_system: source_system || undefined,
            fact: fact || undefined,
            created_at: created_at?.trim() || undefined,
            updated_at: updated_at?.trim() || undefined,
            effective_at: effective_at?.trim() || undefined,
        });
        revalidatePath('/data/requests');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateRequestAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateRequest';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const title = formData.get('title') as string;
    const stable_id = formData.get('stable_id') as string | null;
    const description = formData.get('description') as string | null;
    const priority = formData.get('priority') as string | null;
    const urgency = formData.get('urgency') as string | null;
    const item = formData.get('item') as string | null;
    const request_item = formData.get('request_item') as string | null;
    const caller_name = formData.get('caller_name') as string | null;
    const assigned_to_name = formData.get('assigned_to_name') as string | null;
    const sn_id = formData.get('sn_id') as string | null;
    const category = formData.get('category') as string | null;
    const subcategory = formData.get('subcategory') as string | null;
    const impact = formData.get('impact') as string | null;
    const channel = formData.get('channel') as string | null;
    const assigned_to_oid = formData.get('assigned_to_oid') as string | null;
    const service_catalog_oid = formData.get('service_catalog_oid') as string | null;
    const assigned_group = formData.get('assigned_group') as string | null;
    const configuration_item_oid = formData.get('configuration_item_oid') as string | null;
    const chat_transcripts_str = formData.get('chat_transcripts') as string | null;
    const source_system = formData.get('source_system') as string | null;
    const fact = formData.get('fact') as string | null;
    const state = formData.get('state') as string | null;
    const created_at = formData.get('created_at') as string | null;
    const updated_at = formData.get('updated_at') as string | null;
    const effective_at = formData.get('effective_at') as string | null;

    let chat_transcripts: Record<string, unknown> | undefined = undefined;
    if (chat_transcripts_str) {
        try {
            chat_transcripts = JSON.parse(chat_transcripts_str);
        } catch (e) {
            logger.error(`Invalid chat_transcripts JSON`, e, { requestId, action });
            throw new Error('Invalid chat_transcripts JSON format');
        }
    }

    try {
        await updateRequest(oid, {
            title,
            stable_id: stable_id || undefined,
            description: description || undefined,
            priority: priority || undefined,
            urgency: urgency || undefined,
            item: item || undefined,
            request_item: request_item || undefined,
            caller_name: caller_name || undefined,
            assigned_to_name: assigned_to_name || undefined,
            sn_id: sn_id || undefined,
            category: category || undefined,
            subcategory: subcategory || undefined,
            impact: impact || undefined,
            channel: channel || undefined,
            assigned_to_oid: assigned_to_oid || undefined,
            service_catalog_oid: service_catalog_oid || undefined,
            assigned_group: assigned_group || undefined,
            configuration_item_oid: configuration_item_oid || undefined,
            chat_transcripts,
            source_system: source_system || undefined,
            fact: fact || undefined,
            state: state || undefined,
            created_at: created_at?.trim() || undefined,
            updated_at: updated_at?.trim() || undefined,
            effective_at: effective_at?.trim() || undefined,
        });
        revalidatePath('/data/requests');
        revalidatePath(`/data/requests/${oid}`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteRequestAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteRequest';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    try {
        await deleteRequest(oid);
        revalidatePath('/data/requests');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}


export async function deleteInteractionAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteInteraction';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    try {
        await deleteInteraction(oid);
        revalidatePath('/data/interactions');
        revalidatePath(`/data/interactions/${oid}`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

// ============================================================================
// Analysis Actions
// ============================================================================

export async function createAnalysisAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createAnalysis';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const worker_oid = formData.get('worker_oid') as string;
    const source_type = (formData.get('source_type') as string) || 'survey';
    const source_oid = formData.get('source_oid') as string;
    const source_batch_oid = formData.get('source_batch_oid') as string | null;
    const topic = formData.get('topic') as string;
    const effective_at = formData.get('effective_at') as string | null;
    const keywordsStr = formData.get('keywords') as string | null;
    const factStr = formData.get('fact') as string | null;
    const semantic = formData.get('semantic') as string | null;
    const intent = formData.get('intent') as string | null;
    const service_catalog_oid = formData.get('service_catalog_oid') as string | null;
    const configuration_item_oid = formData.get('configuration_item_oid') as string | null;

    let keywords: string[] | undefined = undefined;
    if (keywordsStr) {
        try {
            keywords = JSON.parse(keywordsStr);
        } catch {
            keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
        }
    }

    try {
        await createAnalysis({
            worker_oid,
            source_type: source_type as 'survey',
            source_oid,
            source_batch_oid: source_batch_oid || undefined,
            topic,
            effective_at: effective_at || undefined,
            keywords,
            fact: factStr?.trim() || undefined,
            semantic: (semantic as 'positive' | 'negative') || undefined,
            intent: (intent as 'request' | 'bug' | 'complaint' | 'praise' | 'suggestion') || undefined,
            service_catalog_oid: service_catalog_oid || undefined,
            configuration_item_oid: configuration_item_oid || undefined,
        });
        revalidatePath('/data/analyses');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateAnalysisAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateAnalysis';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const keywordsStr = formData.get('keywords') as string | null;
    const factStr = formData.get('fact') as string | null;
    const semantic = formData.get('semantic') as string | null;
    const intent = formData.get('intent') as string | null;
    const service_catalog_oid = formData.get('service_catalog_oid') as string | null;
    const configuration_item_oid = formData.get('configuration_item_oid') as string | null;

    let keywords: string[] | null | undefined = undefined;
    if (keywordsStr !== null) {
        if (keywordsStr.trim() === '') {
            keywords = null;
        } else {
            try {
                keywords = JSON.parse(keywordsStr);
            } catch {
                keywords = keywordsStr.split(',').map(k => k.trim()).filter(Boolean);
            }
        }
    }

    try {
        await updateAnalysis(oid, {
            keywords,
            fact: factStr === null ? undefined : (factStr.trim() === '' ? null : factStr.trim()),
            semantic: semantic === '' ? null : (semantic as 'positive' | 'negative' | null) ?? undefined,
            intent: intent === '' ? null : (intent as 'request' | 'bug' | 'complaint' | 'praise' | 'suggestion' | null) ?? undefined,
            service_catalog_oid: service_catalog_oid === '' ? null : service_catalog_oid ?? undefined,
            configuration_item_oid: configuration_item_oid === '' ? null : configuration_item_oid ?? undefined,
        });
        revalidatePath('/data/analyses');
        revalidatePath(`/data/analyses/${oid}`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteAnalysisAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteAnalysis';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    try {
        await deleteAnalysis(oid);
        revalidatePath('/data/analyses');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

// ============================================================================
// Scenario Actions
// ============================================================================

export async function createScenarioAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createScenario';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const worker_oid = formData.get('worker_oid') as string;
    const scenario_type = (formData.get('scenario_type') as string) || 'onboarding';
    const effective_at = formData.get('effective_at') as string;
    const scenario_profile_str = formData.get('scenario_profile') as string | null;

    let scenario_profile: import('@/lib/types/objects').ScenarioProfile | undefined = undefined;
    if (scenario_profile_str) {
        try {
            scenario_profile = JSON.parse(scenario_profile_str);
        } catch {
            throw new Error('Invalid scenario_profile JSON format');
        }
    }

    try {
        await createScenario({
            worker_oid,
            scenario_type,
            effective_at,
            scenario_profile,
        });
        revalidatePath('/data/scenarios');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateScenarioAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateScenario';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    const scenario_type = formData.get('scenario_type') as string | null;
    const scenario_profile_str = formData.get('scenario_profile') as string | null;

    let scenario_profile: import('@/lib/types/objects').ScenarioProfile | undefined = undefined;
    if (scenario_profile_str) {
        try {
            scenario_profile = JSON.parse(scenario_profile_str);
        } catch {
            throw new Error('Invalid scenario_profile JSON format');
        }
    }

    try {
        await updateScenario(oid, {
            scenario_type: scenario_type || undefined,
            scenario_profile,
        });
        revalidatePath('/data/scenarios');
        revalidatePath(`/data/scenarios/${oid}`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteScenarioAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteScenario';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    try {
        await deleteScenario(oid);
        revalidatePath('/data/scenarios');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

// ============================================================================
// Agent Actions
// ============================================================================

export async function createAgentAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createAgent';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    try {
        const agent = await createAgent({
            name: formData.get('name') as string,
            agent_id: formData.get('agent_id') as string,
            agent_platform: formData.get('agent_platform') as string,
            contact_worker_oid: formData.get('contact_worker_oid') as string,
            agent_key: formData.get('agent_key') as string || undefined,
            description: formData.get('description') as string || undefined,
        });
        revalidatePath('/agentops/agents');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return { success: true, agent };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateAgentAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateAgent';
    const startTime = Date.now();
    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const agent = await updateAgent(oid, {
            name: formData.get('name') as string || undefined,
            agent_key: formData.get('agent_key') as string || undefined,
            agent_platform: formData.get('agent_platform') as string || undefined,
            contact_worker_oid: formData.get('contact_worker_oid') as string || undefined,
            description: formData.get('description') as string || undefined,
            is_active: formData.get('is_active') !== null ? formData.get('is_active') === 'true' : undefined,
        });
        revalidatePath('/agentops/agents');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return { success: true, agent };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteAgentAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteAgent';
    const startTime = Date.now();
    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        await deleteAgent(oid);
        revalidatePath('/agentops/agents');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return { success: true };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function createSystemAction(formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:createSystem';
    const startTime = Date.now();
    logger.info(`Started`, { requestId, action });

    try {
        const contactWorkerOid = formData.get('contact_worker_oid') as string;
        const description = formData.get('description') as string;
        const system = await createSystem({
            name: formData.get('name') as string,
            system_id: formData.get('system_id') as string,
            system_platform: formData.get('system_platform') as string,
            contact_worker_oid: contactWorkerOid || undefined,
            description: description || undefined,
        });
        revalidatePath('/data/systems');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return { success: true, system };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function updateSystemAction(oid: string, formData: FormData) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:updateSystem';
    const startTime = Date.now();
    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const system = await updateSystem(oid, {
            name: (formData.get('name') as string) || undefined,
            system_platform: (formData.get('system_platform') as string) || undefined,
            contact_worker_oid: (formData.get('contact_worker_oid') as string) || undefined,
            description: (formData.get('description') as string) || undefined,
            is_active: formData.get('is_active') !== null ? formData.get('is_active') === 'true' : undefined,
        });
        revalidatePath('/data/systems');
        revalidatePath(`/data/systems/${oid}`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return { success: true, system };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

export async function deleteSystemAction(oid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:deleteSystem';
    const startTime = Date.now();
    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        await deleteSystem(oid);
        revalidatePath('/data/systems');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return { success: true };
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
    logger.info(`Started`, { requestId, action });

    try {
        const tagsRaw = formData.get('tags') as string | null;
        const ticket = await createTicket({
            title: formData.get('title') as string,
            description: formData.get('description') as string || undefined,
            assignee_account_oid: formData.get('assignee_account_oid') as string || undefined,
            tags: tagsRaw ? JSON.parse(tagsRaw) : undefined,
        });
        revalidatePath('/agentops/tickets');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return { success: true, ticket };
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
    logger.info(`Started - oid: ${oid}`, { requestId, action });

    try {
        const tagsRaw = formData.get('tags') as string | null;
        const ticket = await updateTicket(oid, {
            title: formData.get('title') as string || undefined,
            description: formData.get('description') as string || undefined,
            status: formData.get('status') as string || undefined,
            flagged: formData.get('flagged') !== null ? formData.get('flagged') === 'true' : undefined,
            assignee_account_oid: formData.get('assignee_account_oid') as string || undefined,
            tags: tagsRaw ? JSON.parse(tagsRaw) : undefined,
        });
        revalidatePath('/agentops/tickets');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return { success: true, ticket };
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
        await deleteTicket(oid);
        revalidatePath('/agentops/tickets');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action });
        return { success: true };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        throw error;
    }
}

// ============================================================================
// Account-Agent / Account-System Link Actions
// ============================================================================

export async function linkAccountAgentAction(accountOid: string, agentOid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:linkAccountAgent';
    logger.info(`Started - account=${accountOid} agent=${agentOid}`, { requestId, action });
    try {
        const link = await linkAccountAgent(accountOid, agentOid);
        revalidatePath('/data/agents');
        revalidatePath(`/data/agents/${agentOid}`);
        logger.info('Success', { requestId, action });
        return { success: true, link };
    } catch (error) {
        logger.error('Failed', error, { requestId, action });
        throw error;
    }
}

export async function unlinkAccountAgentAction(accountOid: string, agentOid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:unlinkAccountAgent';
    logger.info(`Started - account=${accountOid} agent=${agentOid}`, { requestId, action });
    try {
        await unlinkAccountAgent(accountOid, agentOid);
        revalidatePath('/data/agents');
        revalidatePath(`/data/agents/${agentOid}`);
        logger.info('Success', { requestId, action });
        return { success: true };
    } catch (error) {
        logger.error('Failed', error, { requestId, action });
        throw error;
    }
}

export async function linkAccountSystemAction(accountOid: string, systemOid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:linkAccountSystem';
    logger.info(`Started - account=${accountOid} system=${systemOid}`, { requestId, action });
    try {
        const link = await linkAccountSystem(accountOid, systemOid);
        revalidatePath('/data/systems');
        revalidatePath(`/data/systems/${systemOid}`);
        logger.info('Success', { requestId, action });
        return { success: true, link };
    } catch (error) {
        logger.error('Failed', error, { requestId, action });
        throw error;
    }
}

export async function unlinkAccountSystemAction(accountOid: string, systemOid: string) {
    const requestId = logger.generateRequestId();
    const action = 'Objects:unlinkAccountSystem';
    logger.info(`Started - account=${accountOid} system=${systemOid}`, { requestId, action });
    try {
        await unlinkAccountSystem(accountOid, systemOid);
        revalidatePath('/data/systems');
        revalidatePath(`/data/systems/${systemOid}`);
        logger.info('Success', { requestId, action });
        return { success: true };
    } catch (error) {
        logger.error('Failed', error, { requestId, action });
        throw error;
    }
}
