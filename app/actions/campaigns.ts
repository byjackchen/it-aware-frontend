'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import {
    batchUpsertNotificationDetails,
    batchUpsertSurveyDetails,
    createNotification,
    createSurvey,
    createSurveyDetail,
    deleteNotification,
    deleteNotificationDetail,
    deleteSurvey,
    deleteSurveyDetail,
    triggerNotificationNonBlock,
    updateNotification,
    updateSurvey,
    updateSurveyDetail,
} from '@/lib/api/campaigns';
import { PERMISSIONS } from '@/lib/config/permissions';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type {
    Notification,
    NotificationCreate,
    NotificationDetailCreate,
    NotificationUpdate,
    Survey,
    SurveyCreate,
    SurveyDetail,
    SurveyDetailCreate,
    SurveyDetailUpdate,
    SurveyQuestions,
    SurveyUpdate,
} from '@/lib/types/objects';

type CampaignActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

interface AuthMePayload {
    account?: {
        oid?: string;
        username?: string;
    };
    permissions?: {
        unconstrained?: string[];
        self_scoped?: string[];
        role_based?: string[];
    };
}

export interface SurveySpreadsheetImportRow {
    name: string;
    receiver_stable_id: string;
    survey_questions: SurveyQuestions;
}

function formatError(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim().length > 0) return error.message;
    return fallback;
}

function permissionMatches(userPermission: string, requiredPermission: string): boolean {
    if (userPermission === requiredPermission) return true;

    const userSegments = userPermission.split(':');
    const requiredSegments = requiredPermission.split(':');
    if (userSegments.length !== requiredSegments.length) return false;

    return userSegments.every((segment, index) => segment === '*' || segment === requiredSegments[index]);
}

function getPermissionList(payload: AuthMePayload): string[] {
    const permissions = [
        ...(Array.isArray(payload.permissions?.unconstrained) ? payload.permissions.unconstrained : []),
        ...(Array.isArray(payload.permissions?.self_scoped) ? payload.permissions.self_scoped : []),
        ...(Array.isArray(payload.permissions?.role_based) ? payload.permissions.role_based : []),
    ].filter((permission): permission is string => typeof permission === 'string' && permission.length > 0);

    return [...new Set(permissions)];
}

function getCreatorAccount(payload: AuthMePayload): string | null {
    const username = payload.account?.username?.trim();
    if (username) return username;
    const accountOid = payload.account?.oid?.trim();
    if (accountOid) return accountOid;
    return null;
}

async function checkCampaignWritePermission(
    requestId: string,
    action: string,
    requiredPermission: string,
    resourceLabel: string
): Promise<{ authPayload: AuthMePayload } | { error: string }> {
    try {
        const cookieStore = await cookies();
        const cookieHeader = cookieStore
            .getAll()
            .filter(cookie => cookie.name.startsWith('it_aware_'))
            .map(cookie => `${cookie.name}=${cookie.value}`)
            .join('; ');

        const response = await fetch(`${RUNTIME_CONFIG.backend.domain}/auth/me`, {
            method: 'GET',
            headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
            cache: 'no-store',
        });

        if (!response.ok) {
            logger.warn(`Permission check failed with status ${response.status}`, { requestId, action });
            return { error: 'Failed to verify write permission' };
        }

        const authPayload = (await response.json()) as AuthMePayload;
        const hasWritePermission = getPermissionList(authPayload).some(permission =>
            permissionMatches(permission, requiredPermission)
        );

        if (!hasWritePermission) {
            logger.warn(`Missing ${resourceLabel} write permission`, {
                requestId,
                action,
                requiredPermission,
            });
            return { error: 'Write permission is required for this action' };
        }

        return { authPayload };
    } catch (error) {
        logger.error('Permission check failed', error, { requestId, action });
        return { error: 'Failed to verify write permission' };
    }
}

export async function createCampaignNotificationAction(
    payload: NotificationCreate
): Promise<CampaignActionResult<Notification>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:createNotification';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATIONS_WRITE,
        'notifications'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const creatorAccount = getCreatorAccount(writeCheck.authPayload);
        const created = await createNotification({
            ...payload,
            ...(creatorAccount ? { creator_account: creatorAccount } : {}),
        });
        revalidatePath('/campaign');
        revalidatePath('/campaign/notifications');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, notificationOid: created.oid });
        return { success: true, data: created };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        return { success: false, error: formatError(error, 'Failed to create notification') };
    }
}

export async function updateCampaignNotificationAction(
    notificationOid: string,
    payload: NotificationUpdate
): Promise<CampaignActionResult<Notification>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:updateNotification';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATIONS_WRITE,
        'notifications'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const updated = await updateNotification(notificationOid, payload);
        revalidatePath('/campaign/notifications');
        revalidatePath(`/campaign/notifications/${notificationOid}/edit`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, notificationOid });
        return { success: true, data: updated };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationOid });
        return { success: false, error: formatError(error, 'Failed to update notification') };
    }
}

export async function deleteCampaignNotificationAction(notificationOid: string): Promise<CampaignActionResult<null>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:deleteNotification';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATIONS_WRITE,
        'notifications'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        await deleteNotification(notificationOid);
        revalidatePath('/campaign/notifications');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, notificationOid });
        return { success: true, data: null };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationOid });
        return { success: false, error: formatError(error, 'Failed to delete notification') };
    }
}

export async function batchUpsertCampaignNotificationDetailsAction(
    notificationOid: string,
    details: NotificationDetailCreate[]
): Promise<CampaignActionResult<number>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:batchUpsertNotificationDetails';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATIONS_WRITE,
        'notifications'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await batchUpsertNotificationDetails(notificationOid, details);
        revalidatePath('/campaign/notifications');
        revalidatePath(`/campaign/notifications/${notificationOid}/edit`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, {
            requestId,
            action,
            notificationOid,
            detailsCount: result.items.length,
        });
        return { success: true, data: result.items.length };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationOid });
        return { success: false, error: formatError(error, 'Failed to update receivers') };
    }
}

export async function deleteCampaignNotificationDetailAction(
    notificationOid: string,
    receiverStableId: string
): Promise<CampaignActionResult<null>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:deleteNotificationDetail';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATIONS_WRITE,
        'notifications'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        await deleteNotificationDetail(notificationOid, receiverStableId);
        revalidatePath('/campaign/notifications');
        revalidatePath(`/campaign/notifications/${notificationOid}/edit`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, notificationOid, receiverStableId });
        return { success: true, data: null };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationOid, receiverStableId });
        return { success: false, error: formatError(error, 'Failed to remove receiver') };
    }
}

export async function triggerCampaignNotificationAction(notificationOid: string): Promise<CampaignActionResult<string>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:triggerNotification';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATIONS_WRITE,
        'notifications'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await triggerNotificationNonBlock(notificationOid);
        revalidatePath('/campaign/notifications');
        revalidatePath(`/campaign/notifications/${notificationOid}/edit`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, {
            requestId,
            action,
            notificationOid,
            runId: result.run_id,
        });
        return { success: true, data: result.run_id };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationOid });
        return { success: false, error: formatError(error, 'Failed to trigger notification') };
    }
}

export async function createCampaignSurveyAction(
    payload: SurveyCreate
): Promise<CampaignActionResult<Survey>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:createSurvey';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEYS_WRITE,
        'surveys'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const creatorAccount = getCreatorAccount(writeCheck.authPayload);
        const created = await createSurvey({
            ...payload,
            ...(creatorAccount ? { creator_account: creatorAccount } : {}),
        });
        revalidatePath('/campaign');
        revalidatePath('/campaign/surveys');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyOid: created.oid });
        return { success: true, data: created };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        return { success: false, error: formatError(error, 'Failed to create survey') };
    }
}

export async function updateCampaignSurveyAction(
    surveyOid: string,
    payload: SurveyUpdate
): Promise<CampaignActionResult<Survey>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:updateSurvey';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEYS_WRITE,
        'surveys'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const updated = await updateSurvey(surveyOid, payload);
        revalidatePath('/campaign/surveys');
        revalidatePath(`/campaign/surveys/${surveyOid}/edit`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyOid });
        return { success: true, data: updated };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyOid });
        return { success: false, error: formatError(error, 'Failed to update survey') };
    }
}

export async function deleteCampaignSurveyAction(surveyOid: string): Promise<CampaignActionResult<null>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:deleteSurvey';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEYS_WRITE,
        'surveys'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        await deleteSurvey(surveyOid);
        revalidatePath('/campaign/surveys');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyOid });
        return { success: true, data: null };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyOid });
        return { success: false, error: formatError(error, 'Failed to delete survey') };
    }
}

export async function createCampaignSurveyDetailAction(
    surveyOid: string,
    detail: SurveyDetailCreate
): Promise<CampaignActionResult<SurveyDetail>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:createSurveyDetail';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEYS_WRITE,
        'surveys'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const created = await createSurveyDetail(surveyOid, detail);
        revalidatePath('/campaign/surveys');
        revalidatePath(`/campaign/surveys/${surveyOid}/edit`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyOid, receiverStableId: created.receiver_stable_id });
        return { success: true, data: created };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyOid });
        return { success: false, error: formatError(error, 'Failed to create survey detail') };
    }
}

export async function updateCampaignSurveyDetailAction(
    surveyOid: string,
    receiverStableId: string,
    detail: SurveyDetailUpdate
): Promise<CampaignActionResult<SurveyDetail>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:updateSurveyDetail';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEYS_WRITE,
        'surveys'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const updated = await updateSurveyDetail(surveyOid, receiverStableId, detail);
        revalidatePath('/campaign/surveys');
        revalidatePath(`/campaign/surveys/${surveyOid}/edit`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyOid, receiverStableId });
        return { success: true, data: updated };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyOid, receiverStableId });
        return { success: false, error: formatError(error, 'Failed to update survey detail') };
    }
}

export async function batchUpsertCampaignSurveyDetailsAction(
    surveyOid: string,
    details: SurveyDetailCreate[]
): Promise<CampaignActionResult<number>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:batchUpsertSurveyDetails';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEYS_WRITE,
        'surveys'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await batchUpsertSurveyDetails(surveyOid, details);
        revalidatePath('/campaign/surveys');
        revalidatePath(`/campaign/surveys/${surveyOid}/edit`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, {
            requestId,
            action,
            surveyOid,
            detailsCount: result.items.length,
        });
        return { success: true, data: result.items.length };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyOid });
        return { success: false, error: formatError(error, 'Failed to update survey receivers') };
    }
}

export async function deleteCampaignSurveyDetailAction(
    surveyOid: string,
    receiverStableId: string
): Promise<CampaignActionResult<null>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:deleteSurveyDetail';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEYS_WRITE,
        'surveys'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        await deleteSurveyDetail(surveyOid, receiverStableId);
        revalidatePath('/campaign/surveys');
        revalidatePath(`/campaign/surveys/${surveyOid}/edit`);
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyOid, receiverStableId });
        return { success: true, data: null };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyOid, receiverStableId });
        return { success: false, error: formatError(error, 'Failed to remove survey receiver') };
    }
}

export async function createCampaignSurveySpreadsheetImportAction(
    rows: SurveySpreadsheetImportRow[]
): Promise<CampaignActionResult<{ created_oids: string[] }>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:createSurveySpreadsheetImport';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEYS_WRITE,
        'surveys'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    const normalizedRows = rows
        .map((row) => ({
            name: row.name.trim(),
            receiver_stable_id: row.receiver_stable_id.trim(),
            survey_questions: row.survey_questions,
        }))
        .filter((row) => row.name.length > 0 && row.receiver_stable_id.length > 0);

    if (normalizedRows.length === 0) {
        return { success: false, error: 'No valid rows to import' };
    }

    const creatorAccount = getCreatorAccount(writeCheck.authPayload);
    const createdOids: string[] = [];

    try {
        for (const row of normalizedRows) {
            const created = await createSurvey({
                name: row.name,
                survey_questions: row.survey_questions,
                ...(creatorAccount ? { creator_account: creatorAccount } : {}),
                details: [
                    {
                        receiver_stable_id: row.receiver_stable_id,
                        status: 'created',
                    },
                ],
            });
            createdOids.push(created.oid);
        }

        revalidatePath('/campaign');
        revalidatePath('/campaign/surveys');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, createdCount: createdOids.length });
        return {
            success: true,
            data: {
                created_oids: createdOids,
            },
        };
    } catch (error) {
        const rollbackFailures: string[] = [];

        for (const oid of [...createdOids].reverse()) {
            try {
                await deleteSurvey(oid);
            } catch (rollbackError) {
                rollbackFailures.push(`${oid}: ${formatError(rollbackError, 'rollback delete failed')}`);
            }
        }

        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, {
            requestId,
            action,
            createdCountBeforeRollback: createdOids.length,
            rollbackFailures,
        });

        const baseError = formatError(error, 'Failed to import surveys');
        if (rollbackFailures.length > 0) {
            return {
                success: false,
                error: `${baseError}. Rollback incomplete: ${rollbackFailures.join(' | ')}`,
            };
        }

        return {
            success: false,
            error: `${baseError}. All created surveys were rolled back.`,
        };
    }
}
