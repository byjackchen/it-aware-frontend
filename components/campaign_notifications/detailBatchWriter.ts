import { batchUpsertCampaignNotificationsAction } from '@/app/actions/campaigns';
import type { NotificationCreate } from '@/lib/types/objects';

export const NOTIFICATION_BATCH_WRITE_SIZE = 500;

export interface NotificationBatchWriteProgress {
    processedRows: number;
    totalRows: number;
    currentBatch: number;
    totalBatches: number;
}

export interface NotificationBatchWriteSuccess {
    success: true;
    processedRows: number;
    totalRows: number;
    totalBatches: number;
}

export interface NotificationBatchWriteFailure {
    success: false;
    notificationBatchOid: string;
    processedRows: number;
    totalRows: number;
    failedBatch: number;
    totalBatches: number;
    error: string;
}

type NotificationBatchWriteResult = NotificationBatchWriteSuccess | NotificationBatchWriteFailure;

function chunkNotifications(notifications: NotificationCreate[], size: number): NotificationCreate[][] {
    if (size <= 0) return [notifications];
    const chunks: NotificationCreate[][] = [];
    for (let index = 0; index < notifications.length; index += size) {
        chunks.push(notifications.slice(index, index + size));
    }
    return chunks;
}

export async function upsertNotificationsInBatches(
    notificationBatchOid: string,
    notifications: NotificationCreate[],
    onProgress?: (progress: NotificationBatchWriteProgress) => void
): Promise<NotificationBatchWriteResult> {
    const totalRows = notifications.length;
    if (totalRows === 0) {
        return {
            success: true,
            processedRows: 0,
            totalRows: 0,
            totalBatches: 0,
        };
    }

    const batches = chunkNotifications(notifications, NOTIFICATION_BATCH_WRITE_SIZE);
    const totalBatches = batches.length;
    let processedRows = 0;

    for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        const currentBatch = index + 1;

        const result = await batchUpsertCampaignNotificationsAction(notificationBatchOid, batch);
        if (!result.success) {
            return {
                success: false,
                notificationBatchOid,
                processedRows,
                totalRows,
                failedBatch: currentBatch,
                totalBatches,
                error: result.error,
            };
        }

        processedRows += batch.length;
        onProgress?.({
            processedRows,
            totalRows,
            currentBatch,
            totalBatches,
        });
    }

    return {
        success: true,
        processedRows,
        totalRows,
        totalBatches,
    };
}
