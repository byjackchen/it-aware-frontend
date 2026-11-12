/**
 * Knowledge section layout with Catalog Sidebar.
 * Server component that fetches service catalogs and renders the sidebar.
 */

import { getServiceCatalogs } from '@/lib/api/objects';
import { KnowledgeLayoutClient } from './KnowledgeLayoutClient';

export default async function KnowledgeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    let catalogs: Awaited<ReturnType<typeof getServiceCatalogs>> = [];
    let error: string | null = null;

    try {
        catalogs = await getServiceCatalogs();
    } catch (e) {
        console.error('Failed to fetch service catalogs:', e);
        error = 'Failed to load catalogs';
    }

    return (
        <KnowledgeLayoutClient catalogs={catalogs} error={error}>
            {children}
        </KnowledgeLayoutClient>
    );
}
