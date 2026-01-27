/**
 * Inquiry detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getInquiry, getConnectedEdges, getWorkers } from '@/lib/api/objects';
import { InquiryDetailPage } from './InquiryDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function InquiryPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [inquiry, edgesResponse, workers] = await Promise.all([
            getInquiry(oid),
            getConnectedEdges(oid),
            getWorkers(),
        ]);

        return (
            <InquiryDetailPage
                inquiry={inquiry}
                edges={edgesResponse.items}
                workers={workers}
            />
        );
    } catch {
        notFound();
    }
}
