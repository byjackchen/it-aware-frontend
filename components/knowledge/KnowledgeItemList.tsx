'use client';

/**
 * List component for displaying knowledge items (articles).
 * Shows articles section and a placeholder for FAQs.
 */

import { useTranslations } from 'next-intl';
import { FileText, HelpCircle } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { KnowledgeItemCard } from './KnowledgeItemCard';
import { EmptyFaqPlaceholder } from './EmptyFaqPlaceholder';
import type { Article } from '@/lib/types/objects';

interface KnowledgeItemListProps {
    articles: Article[];
    showFaqPlaceholder?: boolean;
}

export function KnowledgeItemList({ articles, showFaqPlaceholder = true }: KnowledgeItemListProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const t = useTranslations('Knowledge');

    return (
        <div className="space-y-8">
            {/* Articles Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <FileText className={`w-5 h-5 ${isLight ? 'text-blue-500' : 'text-blue-400'}`} />
                    <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {t('articles.title')}
                    </h2>
                    <span className={`
                        text-xs px-2 py-0.5 rounded-full
                        ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'}
                    `}>
                        {articles.length}
                    </span>
                </div>

                {articles.length === 0 ? (
                    <div className={`
                        text-sm text-center py-8 px-4 rounded-lg border-2 border-dashed
                        ${isLight
                            ? 'border-slate-200 text-slate-500'
                            : 'border-white/10 text-gray-500'
                        }
                    `}>
                        {t('articles.empty')}
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {articles.map((article) => (
                            <KnowledgeItemCard key={article.oid} article={article} />
                        ))}
                    </div>
                )}
            </section>

            {/* FAQs Section (Placeholder) */}
            {showFaqPlaceholder && (
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <HelpCircle className={`w-5 h-5 ${isLight ? 'text-purple-500' : 'text-purple-400'}`} />
                        <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            {t('faqs.title')}
                        </h2>
                    </div>
                    <EmptyFaqPlaceholder />
                </section>
            )}
        </div>
    );
}
