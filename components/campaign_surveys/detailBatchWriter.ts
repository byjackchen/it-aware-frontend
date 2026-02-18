import { batchUpsertCampaignSurveyDetailsAction } from '@/app/actions/campaigns';
import type { SurveyDetailCreate } from '@/lib/types/objects';

export const SURVEY_DETAIL_BATCH_SIZE = 500;

export interface SurveyDetailBatchProgress {
    processedRows: number;
    totalRows: number;
    currentBatch: number;
    totalBatches: number;
}

export interface SurveyDetailBatchSuccess {
    success: true;
    processedRows: number;
    totalRows: number;
    totalBatches: number;
}

export interface SurveyDetailBatchFailure {
    success: false;
    surveyOid: string;
    processedRows: number;
    totalRows: number;
    failedBatch: number;
    totalBatches: number;
    error: string;
}

type SurveyDetailBatchResult = SurveyDetailBatchSuccess | SurveyDetailBatchFailure;

function chunkDetails(details: SurveyDetailCreate[], size: number): SurveyDetailCreate[][] {
    if (size <= 0) return [details];
    const chunks: SurveyDetailCreate[][] = [];
    for (let index = 0; index < details.length; index += size) {
        chunks.push(details.slice(index, index + size));
    }
    return chunks;
}

export async function upsertSurveyDetailsInBatches(
    surveyOid: string,
    details: SurveyDetailCreate[],
    onProgress?: (progress: SurveyDetailBatchProgress) => void
): Promise<SurveyDetailBatchResult> {
    const totalRows = details.length;
    if (totalRows === 0) {
        return {
            success: true,
            processedRows: 0,
            totalRows: 0,
            totalBatches: 0,
        };
    }

    const batches = chunkDetails(details, SURVEY_DETAIL_BATCH_SIZE);
    const totalBatches = batches.length;
    let processedRows = 0;

    for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        const currentBatch = index + 1;

        const result = await batchUpsertCampaignSurveyDetailsAction(surveyOid, batch);
        if (!result.success) {
            return {
                success: false,
                surveyOid,
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
