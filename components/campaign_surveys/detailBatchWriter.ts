import { batchUpsertCampaignSurveysAction } from '@/app/actions/campaigns';
import type { SurveyCreate } from '@/lib/types/objects';

export const SURVEY_BATCH_WRITE_SIZE = 500;

export interface SurveyBatchWriteProgress {
    processedRows: number;
    totalRows: number;
    currentBatch: number;
    totalBatches: number;
}

export interface SurveyBatchWriteSuccess {
    success: true;
    processedRows: number;
    totalRows: number;
    totalBatches: number;
}

export interface SurveyBatchWriteFailure {
    success: false;
    surveyBatchOid: string;
    processedRows: number;
    totalRows: number;
    failedBatch: number;
    totalBatches: number;
    error: string;
}

type SurveyBatchResult = SurveyBatchWriteSuccess | SurveyBatchWriteFailure;

function chunkSurveys(surveys: SurveyCreate[], size: number): SurveyCreate[][] {
    if (size <= 0) return [surveys];
    const chunks: SurveyCreate[][] = [];
    for (let index = 0; index < surveys.length; index += size) {
        chunks.push(surveys.slice(index, index + size));
    }
    return chunks;
}

export async function upsertSurveysInBatches(
    surveyBatchOid: string,
    surveys: SurveyCreate[],
    onProgress?: (progress: SurveyBatchWriteProgress) => void
): Promise<SurveyBatchResult> {
    const totalRows = surveys.length;
    if (totalRows === 0) {
        return {
            success: true,
            processedRows: 0,
            totalRows: 0,
            totalBatches: 0,
        };
    }

    const batches = chunkSurveys(surveys, SURVEY_BATCH_WRITE_SIZE);
    const totalBatches = batches.length;
    let processedRows = 0;

    for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        const currentBatch = index + 1;

        const result = await batchUpsertCampaignSurveysAction(surveyBatchOid, batch);
        if (!result.success) {
            return {
                success: false,
                surveyBatchOid,
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
