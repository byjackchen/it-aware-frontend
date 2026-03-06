/**
 * Analysis detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getAnalysis } from '@/lib/api/insights';
import { getConnectedEdges, getWorkers, getServiceCatalogs } from '@/lib/api/objects';
import { getSurveyBatches } from '@/lib/api/campaigns';
import { AnalysisDetailPage } from './AnalysisDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function AnalysisPage({ params }: PageProps) {
    const { oid } = await params;

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
            sourceUrl = `/data/surveys/${analysis.source_oid}?batch=${analysis.source_batch_oid}`;
        }

        // Build batch name map
        const batchMap: Record<string, string> = {};
        for (const b of surveyBatchesRes.items) {
            batchMap[b.oid] = b.name;
        }

        return (
            <AnalysisDetailPage
                analysis={analysis}
                edges={edgesResponse.items}
                workers={workers}
                serviceCatalogs={serviceCatalogs}
                sourceUrl={sourceUrl}
                batchMap={batchMap}
            />
        );
    } catch {
        notFound();
    }
}
