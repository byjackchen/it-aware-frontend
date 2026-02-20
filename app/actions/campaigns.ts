'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import {
    batchUpsertNotifications,
    batchUpsertSurveys,
    createNotification,
    createNotificationBatch,
    createSurvey,
    createSurveyBatch,
    deleteNotification,
    deleteNotificationBatch,
    deleteSurvey,
    deleteSurveyBatch,
    postNotificationBatchAction,
    postSurveyAction,
    postSurveyBatchAction,
    updateNotification,
    updateNotificationBatch,
    updateSurvey,
    updateSurveyBatch,
} from '@/lib/api/campaigns';
import { PERMISSIONS } from '@/lib/config/permissions';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type {
    Notification,
    NotificationBatch,
    NotificationBatchCreate,
    NotificationBatchUpdate,
    NotificationCreate,
    NotificationUpdate,
    Survey,
    SurveyAnswerPayload,
    SurveyBatch,
    SurveyBatchCreate,
    SurveyBatchUpdate,
    SurveyCreate,
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

export interface SurveyBatchSpreadsheetImportRow {
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

export async function createCampaignNotificationBatchAction(
    payload: NotificationBatchCreate
): Promise<CampaignActionResult<NotificationBatch>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:createNotificationBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_WRITE,
        'notification_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const creatorAccount = getCreatorAccount(writeCheck.authPayload);
        const created = await createNotificationBatch({
            ...payload,
            ...(creatorAccount ? { creator_account: creatorAccount } : {}),
        });
        revalidatePath('/campaign');
        revalidatePath('/campaign/notification-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, notificationBatchOid: created.oid });
        return { success: true, data: created };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        return { success: false, error: formatError(error, 'Failed to create notification batch') };
    }
}

export async function updateCampaignNotificationBatchAction(
    notificationBatchOid: string,
    payload: NotificationBatchUpdate
): Promise<CampaignActionResult<NotificationBatch>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:updateNotificationBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_WRITE,
        'notification_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const updated = await updateNotificationBatch(notificationBatchOid, payload);
        revalidatePath('/campaign/notification-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, notificationBatchOid });
        return { success: true, data: updated };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationBatchOid });
        return { success: false, error: formatError(error, 'Failed to update notification batch') };
    }
}

export async function deleteCampaignNotificationBatchAction(notificationBatchOid: string): Promise<CampaignActionResult<null>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:deleteNotificationBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_WRITE,
        'notification_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        await deleteNotificationBatch(notificationBatchOid);
        revalidatePath('/campaign/notification-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, notificationBatchOid });
        return { success: true, data: null };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationBatchOid });
        return { success: false, error: formatError(error, 'Failed to delete notification batch') };
    }
}

export async function batchUpsertCampaignNotificationsAction(
    notificationBatchOid: string,
    notifications: NotificationCreate[]
): Promise<CampaignActionResult<number>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:batchUpsertNotifications';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_WRITE,
        'notification_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await batchUpsertNotifications(notificationBatchOid, notifications);
        revalidatePath('/campaign/notification-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, {
            requestId,
            action,
            notificationBatchOid,
            notificationCount: result.items.length,
        });
        return { success: true, data: result.items.length };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationBatchOid });
        return { success: false, error: formatError(error, 'Failed to update receivers') };
    }
}

export async function createCampaignNotificationAction(
    notificationBatchOid: string,
    notification: NotificationCreate
): Promise<CampaignActionResult<Notification>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:createNotification';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_WRITE,
        'notification_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const created = await createNotification(notificationBatchOid, notification);
        revalidatePath('/campaign/notification-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, {
            requestId,
            action,
            notificationBatchOid,
            notificationOid: created.oid,
            receiverStableId: created.receiver_stable_id,
        });
        return { success: true, data: created };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationBatchOid });
        return { success: false, error: formatError(error, 'Failed to create notification row') };
    }
}

export async function updateCampaignNotificationAction(
    notificationBatchOid: string,
    notificationOid: string,
    notification: NotificationUpdate
): Promise<CampaignActionResult<Notification>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:updateNotification';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_WRITE,
        'notification_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const updated = await updateNotification(notificationBatchOid, notificationOid, notification);
        revalidatePath('/campaign/notification-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, notificationBatchOid, notificationOid });
        return { success: true, data: updated };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationBatchOid, notificationOid });
        return { success: false, error: formatError(error, 'Failed to update notification row') };
    }
}

export async function deleteCampaignNotificationAction(
    notificationBatchOid: string,
    notificationOid: string
): Promise<CampaignActionResult<null>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:deleteNotification';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_WRITE,
        'notification_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        await deleteNotification(notificationBatchOid, notificationOid);
        revalidatePath('/campaign/notification-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, notificationBatchOid, notificationOid });
        return { success: true, data: null };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationBatchOid, notificationOid });
        return { success: false, error: formatError(error, 'Failed to remove receiver') };
    }
}

export async function triggerCampaignNotificationBatchAction(
    notificationBatchOid: string
): Promise<CampaignActionResult<NotificationBatch>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:triggerNotificationBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_WRITE,
        'notification_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await postNotificationBatchAction(notificationBatchOid, { action: 'trigger' });
        revalidatePath('/campaign/notification-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, {
            requestId,
            action,
            notificationBatchOid,
            status: result.status,
        });
        return { success: true, data: result };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationBatchOid });
        return { success: false, error: formatError(error, 'Failed to trigger notification batch') };
    }
}

export async function cancelCampaignNotificationBatchAction(
    notificationBatchOid: string
): Promise<CampaignActionResult<NotificationBatch>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:cancelNotificationBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_WRITE,
        'notification_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await postNotificationBatchAction(notificationBatchOid, { action: 'cancel' });
        revalidatePath('/campaign/notification-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, {
            requestId,
            action,
            notificationBatchOid,
            status: result.status,
        });
        return { success: true, data: result };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, notificationBatchOid });
        return { success: false, error: formatError(error, 'Failed to cancel notification batch') };
    }
}

export async function createCampaignSurveyBatchAction(
    payload: SurveyBatchCreate
): Promise<CampaignActionResult<SurveyBatch>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:createSurveyBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const creatorAccount = getCreatorAccount(writeCheck.authPayload);
        const created = await createSurveyBatch({
            ...payload,
            ...(creatorAccount ? { creator_account: creatorAccount } : {}),
        });
        revalidatePath('/campaign');
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid: created.oid });
        return { success: true, data: created };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action });
        return { success: false, error: formatError(error, 'Failed to create survey batch') };
    }
}

export async function updateCampaignSurveyBatchAction(
    surveyBatchOid: string,
    payload: SurveyBatchUpdate
): Promise<CampaignActionResult<SurveyBatch>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:updateSurveyBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const updated = await updateSurveyBatch(surveyBatchOid, payload);
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid });
        return { success: true, data: updated };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid });
        return { success: false, error: formatError(error, 'Failed to update survey batch') };
    }
}

export async function deleteCampaignSurveyBatchAction(surveyBatchOid: string): Promise<CampaignActionResult<null>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:deleteSurveyBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        await deleteSurveyBatch(surveyBatchOid);
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid });
        return { success: true, data: null };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid });
        return { success: false, error: formatError(error, 'Failed to delete survey batch') };
    }
}

export async function publishCampaignSurveyBatchAction(
    surveyBatchOid: string
): Promise<CampaignActionResult<SurveyBatch>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:publishSurveyBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await postSurveyBatchAction(surveyBatchOid, { action: 'publish' });
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid, status: result.status });
        return { success: true, data: result };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid });
        return { success: false, error: formatError(error, 'Failed to publish survey batch') };
    }
}

export async function closeCampaignSurveyBatchAction(
    surveyBatchOid: string
): Promise<CampaignActionResult<SurveyBatch>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:closeSurveyBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await postSurveyBatchAction(surveyBatchOid, { action: 'close' });
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid, status: result.status });
        return { success: true, data: result };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid });
        return { success: false, error: formatError(error, 'Failed to close survey batch') };
    }
}

export async function reopenCampaignSurveyBatchAction(
    surveyBatchOid: string
): Promise<CampaignActionResult<SurveyBatch>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:reopenSurveyBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await postSurveyBatchAction(surveyBatchOid, { action: 'reopen' });
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid, status: result.status });
        return { success: true, data: result };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid });
        return { success: false, error: formatError(error, 'Failed to reopen survey batch') };
    }
}

export async function cancelCampaignSurveyBatchAction(
    surveyBatchOid: string
): Promise<CampaignActionResult<SurveyBatch>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:cancelSurveyBatch';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await postSurveyBatchAction(surveyBatchOid, { action: 'cancel' });
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid, status: result.status });
        return { success: true, data: result };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid });
        return { success: false, error: formatError(error, 'Failed to cancel survey batch') };
    }
}

export async function createCampaignSurveyAction(
    surveyBatchOid: string,
    survey: SurveyCreate
): Promise<CampaignActionResult<Survey>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:createSurvey';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const created = await createSurvey(surveyBatchOid, survey);
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, {
            requestId,
            action,
            surveyBatchOid,
            surveyOid: created.oid,
            receiverStableId: created.receiver_stable_id,
        });
        return { success: true, data: created };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid });
        return { success: false, error: formatError(error, 'Failed to create survey row') };
    }
}

export async function updateCampaignSurveyAction(
    surveyBatchOid: string,
    surveyOid: string,
    survey: SurveyUpdate
): Promise<CampaignActionResult<Survey>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:updateSurvey';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const updated = await updateSurvey(surveyBatchOid, surveyOid, survey);
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid, surveyOid });
        return { success: true, data: updated };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid, surveyOid });
        return { success: false, error: formatError(error, 'Failed to update survey row') };
    }
}

export async function submitCampaignSurveyAction(
    surveyBatchOid: string,
    surveyOid: string,
    surveyAnswer: SurveyAnswerPayload
): Promise<CampaignActionResult<Survey>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:submitSurvey';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const updated = await postSurveyAction(surveyBatchOid, surveyOid, {
            action: 'submit',
            survey_answer: surveyAnswer,
        });
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid, surveyOid, status: updated.status });
        return { success: true, data: updated };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid, surveyOid });
        return { success: false, error: formatError(error, 'Failed to submit survey row') };
    }
}

export async function revokeCampaignSurveyAction(
    surveyBatchOid: string,
    surveyOid: string
): Promise<CampaignActionResult<Survey>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:revokeSurvey';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const updated = await postSurveyAction(surveyBatchOid, surveyOid, {
            action: 'revoke',
        });
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid, surveyOid, status: updated.status });
        return { success: true, data: updated };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid, surveyOid });
        return { success: false, error: formatError(error, 'Failed to revoke survey row') };
    }
}

export async function batchUpsertCampaignSurveysAction(
    surveyBatchOid: string,
    surveys: SurveyCreate[]
): Promise<CampaignActionResult<number>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:batchUpsertSurveys';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        const result = await batchUpsertSurveys(surveyBatchOid, surveys);
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, {
            requestId,
            action,
            surveyBatchOid,
            surveyCount: result.items.length,
        });
        return { success: true, data: result.items.length };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid });
        return { success: false, error: formatError(error, 'Failed to update survey receivers') };
    }
}

export async function deleteCampaignSurveyAction(
    surveyBatchOid: string,
    surveyOid: string
): Promise<CampaignActionResult<null>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:deleteSurvey';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
    );
    if ('error' in writeCheck) {
        return { success: false, error: writeCheck.error };
    }

    try {
        await deleteSurvey(surveyBatchOid, surveyOid);
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, surveyBatchOid, surveyOid });
        return { success: true, data: null };
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, { requestId, action, surveyBatchOid, surveyOid });
        return { success: false, error: formatError(error, 'Failed to remove survey receiver') };
    }
}

export async function createCampaignSurveyBatchSpreadsheetImportAction(
    rows: SurveyBatchSpreadsheetImportRow[]
): Promise<CampaignActionResult<{ created_batch_oids: string[] }>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:createSurveyBatchSpreadsheetImport';
    const startTime = Date.now();

    const writeCheck = await checkCampaignWritePermission(
        requestId,
        action,
        PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE,
        'survey_batchs'
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
    const createdBatchOids: string[] = [];

    try {
        for (const row of normalizedRows) {
            const createdBatch = await createSurveyBatch({
                name: row.name,
                ...(creatorAccount ? { creator_account: creatorAccount } : {}),
            });
            createdBatchOids.push(createdBatch.oid);

            await createSurvey(createdBatch.oid, {
                receiver_stable_id: row.receiver_stable_id,
                survey_questions: row.survey_questions,
            });
        }

        revalidatePath('/campaign');
        revalidatePath('/campaign/survey-batches');
        const duration = Date.now() - startTime;
        logger.info(`Success in ${duration}ms`, { requestId, action, createdCount: createdBatchOids.length });
        return {
            success: true,
            data: {
                created_batch_oids: createdBatchOids,
            },
        };
    } catch (error) {
        const rollbackFailures: string[] = [];

        for (const oid of [...createdBatchOids].reverse()) {
            try {
                await deleteSurveyBatch(oid);
            } catch (rollbackError) {
                rollbackFailures.push(`${oid}: ${formatError(rollbackError, 'rollback delete failed')}`);
            }
        }

        const duration = Date.now() - startTime;
        logger.error(`Failed after ${duration}ms`, error, {
            requestId,
            action,
            createdCountBeforeRollback: createdBatchOids.length,
            rollbackFailures,
        });

        const baseError = formatError(error, 'Failed to import survey batches');
        if (rollbackFailures.length > 0) {
            return {
                success: false,
                error: `${baseError}. Rollback incomplete: ${rollbackFailures.join(' | ')}`,
            };
        }

        return {
            success: false,
            error: `${baseError}. All created survey batches were rolled back.`,
        };
    }
}
