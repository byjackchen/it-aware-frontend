/**
 * Interaction detail page - Server Component.
 */

import { notFound } from 'next/navigation';
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
    } catch {
        notFound();
    }

    return <InteractionDetailPage interaction={interaction} />;
}
