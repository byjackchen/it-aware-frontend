/**
 * Knowledge main page - shows overview of catalogs.
 */

import { getServiceCatalogs, getArticles } from '@/lib/api/objects';
import { KnowledgeOverview } from './KnowledgeOverview';
import type { ServiceCatalog, Article } from '@/lib/types/objects';

export default async function KnowledgePage() {
    let catalogs: ServiceCatalog[] = [];
    let articles: Article[] = [];

    try {
        [catalogs, articles] = await Promise.all([
            getServiceCatalogs(),
            getArticles(),
        ]);
    } catch (e) {
        console.error('Failed to fetch knowledge data:', e);
    }

    return <KnowledgeOverview catalogs={catalogs} articles={articles} />;
}
