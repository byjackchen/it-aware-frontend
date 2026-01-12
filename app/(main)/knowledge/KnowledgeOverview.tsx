'use client';

/**
 * Knowledge overview page - shows welcome message and recent articles.
 */

import { FileText, Layers, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/lib/contexts/theme-context';
import { KnowledgeItemCard } from '@/components/knowledge';
import type { ServiceCatalog, Article } from '@/lib/types/objects';

interface KnowledgeOverviewProps {
    catalogs: ServiceCatalog[];
    articles: Article[];
}

export function KnowledgeOverview({ catalogs, articles }: KnowledgeOverviewProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // Get recent articles (last 6)
    const recentArticles = [...articles]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 6);

    // Count root-level catalogs
    const rootCatalogs = catalogs.filter(c => !c.parent_oid);

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Welcome Header */}
            <div className={`
                p-8 rounded-2xl
                ${isLight
                    ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100'
                    : 'bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-500/20'
                }
            `}>
                <h1 className={`text-2xl font-bold mb-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    Knowledge Base
                </h1>
                <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                    Browse articles and documentation organized by service catalog.
                    Select a category from the sidebar to view related content.
                </p>

                {/* Stats */}
                <div className="flex gap-6 mt-6">
                    <div className="flex items-center gap-2">
                        <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center
                            ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
                        `}>
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <div className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {rootCatalogs.length}
                            </div>
                            <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                Catalogs
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center
                            ${isLight ? 'bg-green-100 text-green-600' : 'bg-green-500/20 text-green-400'}
                        `}>
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <div className={`text-xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {articles.length}
                            </div>
                            <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                Articles
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Articles */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <FileText className={`w-5 h-5 ${isLight ? 'text-blue-500' : 'text-blue-400'}`} />
                        <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            Recent Articles
                        </h2>
                    </div>
                    {articles.length > 6 && (
                        <Link
                            href="/knowledge/articles"
                            className={`
                                flex items-center gap-1 text-sm font-medium
                                ${isLight
                                    ? 'text-blue-500 hover:text-blue-600'
                                    : 'text-blue-400 hover:text-blue-300'
                                }
                            `}
                        >
                            View all
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    )}
                </div>

                {recentArticles.length === 0 ? (
                    <div className={`
                        text-sm text-center py-12 px-4 rounded-lg border-2 border-dashed
                        ${isLight
                            ? 'border-slate-200 text-slate-500'
                            : 'border-white/10 text-gray-500'
                        }
                    `}>
                        No articles yet. Select a catalog from the sidebar to browse content.
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {recentArticles.map((article) => (
                            <KnowledgeItemCard key={article.oid} article={article} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
