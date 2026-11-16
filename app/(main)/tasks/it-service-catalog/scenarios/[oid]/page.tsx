/**
 * Scenario detail page - Server Component.
 */

import type { ComponentProps } from 'react';
import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getConnectedEdges, getWorkers } from '@/lib/api/objects';
import { getScenario } from '@/lib/api/scenarios';
import { ScenarioDetailPage } from './ScenarioDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function ScenarioPage({ params }: PageProps) {
    const { oid } = await params;

    // Built outside the try: React renders after this returns, so a try cannot catch its errors.
    let props: ComponentProps<typeof ScenarioDetailPage>;
    try {
        const [scenario, edgesResponse, workers] = await Promise.all([
            getScenario(oid),
            getConnectedEdges(oid),
            getWorkers(),
        ]);

        props = { scenario, edges: edgesResponse.items, workers };
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }

    return <ScenarioDetailPage {...props} />;
}
