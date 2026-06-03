/**
 * System detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getSystem, getWorkers } from '@/lib/api/objects';
import { SystemDetailPage } from './SystemDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function SystemPage({ params }: PageProps) {
    const { oid } = await params;
    const [system, workers] = await Promise.all([
        getSystem(oid),
        getWorkers(),
    ]).catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    });

    return <SystemDetailPage system={system} workers={workers} />;
}
