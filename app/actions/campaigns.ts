'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import {
    batchUpsertNotificationDetails,
    createNotification,
    deleteNotification,
    deleteNotificationDetail,
    triggerNotificationNonBlock,
    updateNotification,
} from '@/lib/api/campaigns';
import { PERMISSIONS } from '@/lib/config/permissions';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type {
    Notification,
    NotificationCreate,
    NotificationDetailCreate,
    NotificationUpdate,
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

async function checkNotificationsWritePermission(
    requestId: string,
    action: string
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
            permissionMatches(permission, PERMISSIONS.OBJECTS.NOTIFICATIONS_WRITE)
        );

        if (!hasWritePermission) {
            logger.warn('Missing notifications write permission', {
                requestId,
                action,
                requiredPermission: PERMISSIONS.OBJECTS.NOTIFICATIONS_WRITE,
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

    const writeCheck = await checkNotificationsWritePermission(requestId, action);
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

    const writeCheck = await checkNotificationsWritePermission(requestId, action);
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

    const writeCheck = await checkNotificationsWritePermission(requestId, action);
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

    const writeCheck = await checkNotificationsWritePermission(requestId, action);
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

    const writeCheck = await checkNotificationsWritePermission(requestId, action);
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

    const writeCheck = await checkNotificationsWritePermission(requestId, action);
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
