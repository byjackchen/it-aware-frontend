/**
 * Survey detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getSurvey, getSurveyBatch } from '@/lib/api/campaigns';
import { getWorkers } from '@/lib/api/objects';
import { SurveyDetailPage } from './SurveyDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function SurveyPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const survey = await getSurvey(oid);
        const [surveyBatch, workers] = await Promise.all([
            getSurveyBatch(survey.survey_batch_oid),
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
