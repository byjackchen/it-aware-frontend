/**
 * Analysis detail page - Server Component.
 */

import type { ComponentProps } from 'react';
import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getAnalysis } from '@/lib/api/insights';
import { getConnectedEdges, getWorkers, getServiceCatalogs } from '@/lib/api/objects';
import { getSurveyBatches } from '@/lib/api/campaigns';
import { AnalysisDetailPage } from './AnalysisDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function AnalysisPage({ params }: PageProps) {
    const { oid } = await params;

    // Built outside the try: React renders after this returns, so a try cannot catch its errors.
    let props: ComponentProps<typeof AnalysisDetailPage>;
    try {
        const [analysis, edgesResponse, workers, serviceCatalogs, surveyBatchesRes] = await Promise.all([
            getAnalysis(oid),
            getConnectedEdges(oid),
            getWorkers(),
            getServiceCatalogs(),
            getSurveyBatches({ limit: 1000 }),
        ]);

        // Build source URL using source_batch_oid if available
        let sourceUrl: string | null = null;
        if (analysis.source_type === 'survey' && analysis.source_batch_oid) {
            sourceUrl = `/tasks/surveys/records/${analysis.source_oid}?batch=${analysis.source_batch_oid}`;
        }

        // Build batch name map
        const batchMap: Record<string, string> = {};
        for (const b of surveyBatchesRes.items) {
            batchMap[b.oid] = b.name;
        }

        props = { analysis, edges: edgesResponse.items, workers, serviceCatalogs, sourceUrl, batchMap };
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }

    return <AnalysisDetailPage {...props} />;
}
