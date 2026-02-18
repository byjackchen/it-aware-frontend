'use server';

import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import {
    batchUpsertNotificationDetails,
    createNotification,
    deleteNotification,
    deleteNotificationDetail,
    triggerNotificationNonBlock,
    updateNotification,
} from '@/lib/api/campaigns';
import type {
    Notification,
    NotificationCreate,
    NotificationDetailCreate,
    NotificationUpdate,
} from '@/lib/types/objects';

type CampaignActionResult<T> =
    | { success: true; data: T }
    | { success: false; error: string };

function formatError(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim().length > 0) return error.message;
    return fallback;
}

export async function createCampaignNotificationAction(
    payload: NotificationCreate
): Promise<CampaignActionResult<Notification>> {
    const requestId = logger.generateRequestId();
    const action = 'Campaign:createNotification';
    const startTime = Date.now();

    try {
        const created = await createNotification(payload);
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
