/**
 * Survey detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getSurvey, getSurveyBatch } from '@/lib/api/campaigns';
import { getWorkers } from '@/lib/api/objects';
import { SurveyDetailPage } from './SurveyDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
    searchParams: Promise<{ batch?: string }>;
}

export default async function SurveyPage({ params, searchParams }: PageProps) {
    const { oid } = await params;
    const { batch } = await searchParams;

    if (!batch) {
        notFound();
    }

    try {
        const [survey, surveyBatch, workers] = await Promise.all([
            getSurvey(batch, oid),
            getSurveyBatch(batch),
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
