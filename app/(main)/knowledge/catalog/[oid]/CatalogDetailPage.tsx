'use client';

/**
 * Client component for Catalog detail page.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight, Folder } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { KnowledgeItemList } from '@/components/knowledge';
import type { ServiceCatalog, Article } from '@/lib/types/objects';

interface CatalogDetailPageProps {
    catalog: ServiceCatalog;
    articles: Article[];
    breadcrumb: { oid: string; name: string }[];
}

export function CatalogDetailPage({ catalog, articles, breadcrumb }: CatalogDetailPageProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const t = useTranslations('Knowledge');

    const articleCountText = articles.length === 1
        ? t('catalog.articleCount', { count: articles.length })
        : t('catalog.articleCountPlural', { count: articles.length });

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1 text-sm">
                <Link
                    href="/knowledge"
                    className={`
                        hover:underline
                        ${isLight ? 'text-slate-500 hover:text-slate-700' : 'text-gray-500 hover:text-gray-300'}
                    `}
                >
                    {t('overview.title')}
                </Link>
                {breadcrumb.map((item, index) => (
                    <div key={item.oid} className="flex items-center gap-1">
                        <ChevronRight className={`w-4 h-4 ${isLight ? 'text-slate-300' : 'text-gray-600'}`} />
                        {index === breadcrumb.length - 1 ? (
                            <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {item.name}
                            </span>
                        ) : (
                            <Link
                                href={`/knowledge/catalog/${item.oid}`}
                                className={`
                                    hover:underline
                                    ${isLight ? 'text-slate-500 hover:text-slate-700' : 'text-gray-500 hover:text-gray-300'}
                                `}
                            >
                                {item.name}
                            </Link>
                        )}
                    </div>
                ))}
            </nav>

            {/* Header */}
            <div className={`
                flex items-center gap-4 p-6 rounded-xl
                ${isLight
                    ? 'bg-white border border-slate-200'
                    : 'bg-gray-800/50 border border-white/5'
                }
            `}>
                <div className={`
                    w-12 h-12 rounded-xl flex items-center justify-center
                    ${isLight ? 'bg-blue-50 text-blue-500' : 'bg-blue-500/20 text-blue-400'}
                `}>
                    <Folder className="w-6 h-6" />
                </div>
                <div>
                    <h1 className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {catalog.name}
                    </h1>
                    <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                        {articleCountText}
                    </p>
                </div>
            </div>

            {/* Knowledge Items */}
            <KnowledgeItemList articles={articles} />
        </div>
    );
}
