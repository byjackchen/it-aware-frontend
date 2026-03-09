/**
 * Survey detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getSurvey, getSurveyBatch, getSurveyBatches } from '@/lib/api/campaigns';
import { getWorkers } from '@/lib/api/objects';
import { SurveyDetailPage } from './SurveyDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
    searchParams: Promise<{ batch?: string }>;
}

async function findBatchForSurvey(surveyOid: string): Promise<string | null> {
    const { items: batches } = await getSurveyBatches({ limit: 100 });
    for (const b of batches) {
        try {
            await getSurvey(b.oid, surveyOid);
            return b.oid;
        } catch {
            continue;
        }
    }
    return null;
}

export default async function SurveyPage({ params, searchParams }: PageProps) {
    const { oid } = await params;
    const { batch } = await searchParams;

    try {
        const batchOid = batch || await findBatchForSurvey(oid);
        if (!batchOid) notFound();

        const [survey, surveyBatch, workers] = await Promise.all([
            getSurvey(batchOid, oid),
            getSurveyBatch(batchOid),
            getWorkers(),
        ]);

        return (
            <SurveyDetailPage
                survey={survey}
                surveyBatch={surveyBatch}
                workers={workers}
            />
        );
    } catch {
        notFound();
    }
}
