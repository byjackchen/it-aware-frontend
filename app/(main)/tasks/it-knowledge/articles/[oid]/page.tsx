/**
 * Article detail page - Server Component.
 */

import type { ComponentProps } from 'react';
import { notFound } from 'next/navigation';
import { getArticle, getArticleVersions, getConnectedEdges, getServiceCatalogs } from '@/lib/api/objects';
import { ArticleDetailPage } from './ArticleDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function ArticlePage({ params }: PageProps) {
    const { oid } = await params;

    // Built outside the try: React renders after this returns, so a try cannot catch its errors.
    let props: ComponentProps<typeof ArticleDetailPage>;
    try {
        // Log start of requests
        console.log(`Fetching data for article ${oid}...`);

        // Execute requests in parallel but catch errors individually for better debugging
        const articlePromise = getArticle(oid).catch(e => { console.error('getArticle failed', e); throw e; });
        const versionsPromise = getArticleVersions(oid).catch(e => { console.error('getArticleVersions failed', e); throw e; });
        const edgesPromise = getConnectedEdges(oid).catch(e => { console.error('getConnectedEdges failed', e); throw e; });
        const serviceCatalogsPromise = getServiceCatalogs().catch(e => { console.error('getServiceCatalogs failed', e); throw e; });

        const [article, versions, edgesResponse, serviceCatalogs] = await Promise.all([
            articlePromise,
            versionsPromise,
            edgesPromise,
            serviceCatalogsPromise,
        ]);

        console.log('Successfully fetched all article data');

        props = { article, versions, edges: edgesResponse.items, serviceCatalogs };
    } catch (error) {
        console.error('Error fetching data for article details:', error);
        notFound();
    }

    return <ArticleDetailPage {...props} />;
}
