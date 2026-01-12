/**
 * Articles list page - Server Component.
 */

import { getArticles, getServiceCatalogs } from '@/lib/api/objects';
import { ArticlesListPage } from './ArticlesListPage';

export default async function ArticlesPage() {
    const [articles, serviceCatalogs] = await Promise.all([
        getArticles(),
        getServiceCatalogs(),
    ]);

    return <ArticlesListPage articles={articles} serviceCatalogs={serviceCatalogs} />;
}
