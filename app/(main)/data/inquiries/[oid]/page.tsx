/**
 * Inquiry detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getInquiry, getConnectedEdges, getWorkers, getServiceCatalogs } from '@/lib/api/objects';
import { InquiryDetailPage } from './InquiryDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function InquiryPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [inquiry, edgesResponse, workers, serviceCatalogs] = await Promise.all([
            getInquiry(oid),
            getConnectedEdges(oid),
            getWorkers(),
            getServiceCatalogs(),
        ]);

        return (
            <InquiryDetailPage
                inquiry={inquiry}
                edges={edgesResponse.items}
                workers={workers}
                serviceCatalogs={serviceCatalogs}
            />
        );
    } catch {
        notFound();
    }
}
