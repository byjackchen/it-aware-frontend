'use client';

/**
 * Articles list page client component.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, Plus, RefreshCw, Search, Layers, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { useLazyResourceList } from '@/lib/hooks/useLazyResourceList';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import { InfiniteLoadTrigger } from '@/components/data/InfiniteLoadTrigger';
import { formatDate } from '@/lib/utils/datetime';
import type { Article, ServiceCatalog } from '@/lib/types/objects';

export function ArticlesListPage() {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useRouter();
    const t = useTranslations('Data.articles');
    const commonT = useTranslations('Data.common');
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');
    const [catalogFilter, setCatalogFilter] = useState<string | null>(null);

    const {
        items: articles,
        total: totalArticles,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        reload,
    } = useInfiniteResource<Article>('articles', {
        pageSize: 300,
        auto: true,
    });

    const { items: serviceCatalogs } = useLazyResourceList<ServiceCatalog>('service-catalogs', {
        query: { limit: 1000 },
        auto: true,
    });

    const catalogMap = useMemo(
        () => new Map(serviceCatalogs.map((c) => [c.oid, c.name])),
        [serviceCatalogs]
    );

    const filteredArticles = useMemo(() => {
        return articles.filter((a) => {
            const matchesSearch = searchQuery === '' ||
                a.latest_version.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (a.latest_version.summary && a.latest_version.summary.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesCatalog = catalogFilter === null || a.service_catalog_id === catalogFilter;
            return matchesSearch && matchesCatalog;
        });
    }, [articles, catalogFilter, searchQuery]);

    const handleRefresh = () => {
        void reload();
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('title')}</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {articles.filter(a => a.is_active).length.toLocaleString()} Active Loaded / {articles.length.toLocaleString()} Loaded / {(totalArticles ?? articles.length).toLocaleString()} Total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${(isInitialLoading || isLoadingMore) ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => router.push('/data/articles/new')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors">
                            <Plus className="w-4 h-4" />
                            <span>{t('new')}</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={commonT('search')}
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <select
                            value={catalogFilter || ''}
                            onChange={(e) => setCatalogFilter(e.target.value || null)}
                            className={`px-3 py-2 text-sm rounded-lg border outline-none ${isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`}
                        >
                            <option value="">{commonT('all')} {t('serviceCatalogs')}</option>
                            {serviceCatalogs.map(catalog => (
                                <option key={catalog.oid} value={catalog.oid}>{catalog.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {isInitialLoading && articles.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading articles...</span>
                        </div>
                    ) : error && articles.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredArticles.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('empty')}</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredArticles.map((article) => (
                                <button
                                    key={article.oid}
                                    onClick={() => router.push(`/data/articles/${article.oid}`)}
                                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{article.latest_version.title}</div>
                                            {!article.is_active && (
                                                <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-500 font-medium">{t('inactive')}</span>
                                            )}
                                            <span className={`px-2 py-0.5 text-xs rounded-full ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/10 text-gray-400'}`}>v{article.effective_version_number}</span>
                                        </div>
                                        {article.latest_version.summary && (
                                            <div className={`text-sm mb-1 line-clamp-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                {article.latest_version.summary}
                                            </div>
                                        )}
                                        <div className={`flex items-center gap-4 text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                            <div className="flex items-center gap-1">
                                                <Layers className="w-3 h-3" />
                                                <span>{catalogMap.get(article.service_catalog_id) || article.service_catalog_id}</span>
                                            </div>
                                            <div>{commonT('updated')} {formatDate(article.updated_at, timezone)}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {hasMore && (
                    <InfiniteLoadTrigger
                        disabled={isInitialLoading || isLoadingMore}
                        onVisible={() => void loadMore()}
                    />
                )}

                {isLoadingMore && (
                    <div className={`py-4 text-center text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading more articles...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
