import { batchUpsertCampaignNotificationDetailsAction } from '@/app/actions/campaigns';
import type { NotificationDetailCreate } from '@/lib/types/objects';

export const DETAIL_BATCH_SIZE = 500;

export interface DetailBatchProgress {
    processedRows: number;
    totalRows: number;
    currentBatch: number;
    totalBatches: number;
}

export interface DetailBatchSuccess {
    success: true;
    processedRows: number;
    totalRows: number;
    totalBatches: number;
}

export interface DetailBatchFailure {
    success: false;
    notificationOid: string;
    processedRows: number;
    totalRows: number;
    failedBatch: number;
    totalBatches: number;
    error: string;
}

type DetailBatchResult = DetailBatchSuccess | DetailBatchFailure;

function chunkDetails(details: NotificationDetailCreate[], size: number): NotificationDetailCreate[][] {
    if (size <= 0) return [details];
    const chunks: NotificationDetailCreate[][] = [];
    for (let index = 0; index < details.length; index += size) {
        chunks.push(details.slice(index, index + size));
    }
    return chunks;
}

export async function upsertNotificationDetailsInBatches(
    notificationOid: string,
    details: NotificationDetailCreate[],
    onProgress?: (progress: DetailBatchProgress) => void
): Promise<DetailBatchResult> {
    const totalRows = details.length;
    if (totalRows === 0) {
        return {
            success: true,
            processedRows: 0,
            totalRows: 0,
            totalBatches: 0,
        };
    }

    const batches = chunkDetails(details, DETAIL_BATCH_SIZE);
    const totalBatches = batches.length;
    let processedRows = 0;

    for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        const currentBatch = index + 1;

        const result = await batchUpsertCampaignNotificationDetailsAction(notificationOid, batch);
        if (!result.success) {
            return {
                success: false,
                notificationOid,
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
