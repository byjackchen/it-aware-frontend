import { notFound } from 'next/navigation';
import { SurveyEditWorkspace } from '@/components/campaign_surveys';
import { getSurvey, getSurveyDetails } from '@/lib/api/campaigns';
import type { Survey, SurveyDetail } from '@/lib/types/objects';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function CampaignSurveyEditPage({ params }: PageProps) {
    const { oid } = await params;

    let survey: Survey;
    let details: SurveyDetail[];

    try {
        const [surveyPayload, detailsPayload] = await Promise.all([
            getSurvey(oid),
            getSurveyDetails(oid, { limit: 1000, skip: 0 }),
        ]);

        survey = surveyPayload;
        details = detailsPayload.items;
    } catch {
        notFound();
    }

    return <SurveyEditWorkspace survey={survey} details={details} />;
}
