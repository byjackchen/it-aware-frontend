/**
 * Analysis detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getAnalysis } from '@/lib/api/insights';
import { getConnectedEdges, getWorkers, getServiceCatalogs } from '@/lib/api/objects';
import { AnalysisDetailPage } from './AnalysisDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function AnalysisPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [analysis, edgesResponse, workers, serviceCatalogs] = await Promise.all([
            getAnalysis(oid),
            getConnectedEdges(oid),
            getWorkers(),
            getServiceCatalogs(),
        ]);

        return (
            <AnalysisDetailPage
                analysis={analysis}
                edges={edgesResponse.items}
                workers={workers}
                serviceCatalogs={serviceCatalogs}
            />
        );
    } catch {
        notFound();
    }
}
