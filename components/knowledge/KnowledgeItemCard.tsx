'use client';

/**
 * Card component for displaying a knowledge item (article) preview.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FileText, ExternalLink, Calendar } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Article } from '@/lib/types/objects';

interface KnowledgeItemCardProps {
    article: Article;
}

export function KnowledgeItemCard({ article }: KnowledgeItemCardProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const t = useTranslations('Knowledge');

    const { latest_version } = article;
    const formattedDate = new Date(article.updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

    // Truncate summary for preview
    const previewText = latest_version.summary
        || latest_version.markdown.slice(0, 150).replace(/[#*`]/g, '') + '...';

    return (
        <Link
            href={`/data/articles/${article.oid}`}
            className={`
                block p-4 rounded-lg border transition-all duration-200
                ${isLight
                    ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                    : 'bg-gray-800/50 border-white/10 hover:border-blue-500/50 hover:bg-gray-800'
                }
            `}
        >
            {/* Header */}
            <div className="flex items-start gap-3">
                <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                    ${isLight
                        ? 'bg-blue-50 text-blue-500'
                        : 'bg-blue-500/20 text-blue-400'
                    }
                `}>
                    <FileText className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h3 className={`
                        text-sm font-semibold truncate
                        ${isLight ? 'text-slate-800' : 'text-white'}
                    `}>
                        {latest_version.title}
                    </h3>

                    {/* Preview */}
                    <p className={`
                        text-xs mt-1 line-clamp-2
                        ${isLight ? 'text-slate-500' : 'text-gray-400'}
                    `}>
                        {previewText}
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className={`
                flex items-center gap-4 mt-3 pt-3 border-t
                ${isLight ? 'border-slate-100' : 'border-white/5'}
            `}>
                {/* Type Badge */}
                <span className={`
                    text-xs px-2 py-0.5 rounded-full font-medium
                    ${isLight
                        ? 'bg-blue-50 text-blue-600'
                        : 'bg-blue-500/20 text-blue-300'
                    }
                `}>
                    {t('articles.article')}
                </span>

                {/* Date */}
                <div className={`
                    flex items-center gap-1 text-xs
                    ${isLight ? 'text-slate-400' : 'text-gray-500'}
                `}>
                    <Calendar className="w-3 h-3" />
                    <span>{formattedDate}</span>
                </div>

                {/* Source Link */}
                {latest_version.source_url && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(latest_version.source_url!, '_blank', 'noopener,noreferrer');
                        }}
                        className={`
                            flex items-center gap-1 text-xs ml-auto
                            ${isLight
                                ? 'text-blue-500 hover:text-blue-600'
                                : 'text-blue-400 hover:text-blue-300'
                            }
                        `}
                    >
                        <ExternalLink className="w-3 h-3" />
                        <span>{t('articles.source')}</span>
                    </button>
                )}
            </div>
        </Link>
    );
}
