/**
 * Scenario detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getConnectedEdges, getWorkers } from '@/lib/api/objects';
import { getScenario } from '@/lib/api/scenarios';
import { ScenarioDetailPage } from './ScenarioDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function ScenarioPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [scenario, edgesResponse, workers] = await Promise.all([
            getScenario(oid),
            getConnectedEdges(oid),
            getWorkers(),
        ]);

        return (
            <ScenarioDetailPage
                scenario={scenario}
                edges={edgesResponse.items}
                workers={workers}
            />
        );
    } catch {
        notFound();
    }
}
