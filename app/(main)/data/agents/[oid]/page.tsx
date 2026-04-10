/**
 * Agent detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getAgent, getWorkers } from '@/lib/api/objects';
import { AgentDetailPage } from './AgentDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function AgentPage({ params }: PageProps) {
    const { oid } = await params;
    const [agent, workers] = await Promise.all([
        getAgent(oid),
        getWorkers(),
    ]).catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    });

    return (
        <AgentDetailPage
            agent={agent}
            workers={workers}
        />
    );
}
