/**
 * Catalog detail page - shows articles for a specific service catalog.
 * Server Component.
 */

import type { ComponentProps } from 'react';
import { notFound } from 'next/navigation';
import { getServiceCatalog, getServiceCatalogs, getArticles } from '@/lib/api/objects';
import { CatalogDetailPage } from './CatalogDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function CatalogPage({ params }: PageProps) {
    const { oid } = await params;

    // Built outside the try: React renders after this returns, so a try cannot catch its errors.
    let props: ComponentProps<typeof CatalogDetailPage>;
    try {
        // Fetch catalog details and articles in parallel
        const [catalog, allCatalogs, articles] = await Promise.all([
            getServiceCatalog(oid),
            getServiceCatalogs(),
            getArticles(oid), // Filter by service_catalog_id
        ]);

        // Build breadcrumb path
        const breadcrumb = buildBreadcrumb(catalog.path, allCatalogs);

        props = { catalog, articles, breadcrumb };
    } catch (error) {
        console.error('Error fetching catalog details:', error);
        notFound();
    }

    return <CatalogDetailPage {...props} />;
}

/**
 * Build breadcrumb from catalog path.
 */
function buildBreadcrumb(
    path: string[],
    allCatalogs: { oid: string; name: string }[]
): { oid: string; name: string }[] {
    const catalogMap = new Map(allCatalogs.map(c => [c.oid, c]));
    return path
        .map(oid => catalogMap.get(oid))
        .filter((c): c is { oid: string; name: string } => c !== undefined);
}
