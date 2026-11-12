/**
 * Survey detail page - Server Component.
 */

import type { ComponentProps } from 'react';
import { notFound } from 'next/navigation';
import { getSurvey, getSurveyBatch } from '@/lib/api/campaigns';
import { getWorkers } from '@/lib/api/objects';
import { SurveyDetailPage } from './SurveyDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function SurveyPage({ params }: PageProps) {
    const { oid } = await params;

    // Built outside the try: React renders after this returns, so a try cannot catch its errors.
    let props: ComponentProps<typeof SurveyDetailPage>;
    try {
        const survey = await getSurvey(oid);
        const [surveyBatch, workers] = await Promise.all([
            getSurveyBatch(survey.survey_batch_oid),
            getWorkers(),
        ]);

        props = { survey, surveyBatch, workers };
    } catch {
        notFound();
    }

    return <SurveyDetailPage {...props} />;
}
