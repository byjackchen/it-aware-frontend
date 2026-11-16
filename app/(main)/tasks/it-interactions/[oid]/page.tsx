/**
 * Interaction detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getInteraction } from '@/lib/api/objects';
import type { Interaction } from '@/lib/types/objects';
import { InteractionDetailPage } from './InteractionDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function InteractionPage({ params }: PageProps) {
    const { oid } = await params;

    let interaction: Interaction;
    try {
        interaction = await getInteraction(oid);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }

    return <InteractionDetailPage interaction={interaction} />;
}
