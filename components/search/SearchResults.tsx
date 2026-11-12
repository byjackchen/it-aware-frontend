'use client';

/**
 * Search results dropdown component.
 * Renders the groups the search answers with (tasks, then records by kind);
 * each result opens its page. A task shows its grouping beside it, and can be
 * pinned to the home from here.
 */

import { useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { FileText, ListChecks, Loader2, Pin, PinOff } from 'lucide-react';
import { setTaskPinned } from '@/app/actions/tasks';
import { useTheme } from '@/lib/contexts/theme-context';
import { SEARCH_CONFIG } from '@/lib/config/search';
import { pageHref } from '@/lib/tasks/catalog';
import type { SearchGroup, SearchResult } from '@/lib/types/search';

interface SearchResultsProps {
    results: SearchGroup[];
    isLoading: boolean;
    onSelect: () => void;
}

export function SearchResults({ results, isLoading, onSelect }: SearchResultsProps) {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const t = useTranslations('GlobalSearch');
    const isLight = theme === 'light';
    // Pins changed here, by task code; a result's own `pinned` holds until then.
    const [pins, setPins] = useState<Record<string, boolean>>({});

    const togglePin = async (item: SearchResult, pinned: boolean) => {
        setPins(current => ({ ...current, [item.id]: !pinned }));
        const outcome = await setTaskPinned(item.id, !pinned);
        if ('error' in outcome) {
            setPins(current => ({ ...current, [item.id]: pinned }));
        }
    };

    const handleClick = (item: SearchResult) => {
        router.push(pageHref(item.opens));
        onSelect();
    };

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center gap-2 py-4 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t('searching')}</span>
            </div>
        );
    }

    if (results.length === 0) {
        return (
            <div className={`py-4 text-center text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                {t('noResults')}
            </div>
        );
    }

    return (
        <div className="max-h-80 overflow-y-auto" data-testid="search-results">
            {results.map((group) => {
                const config = SEARCH_CONFIG[group.kind];
                const Icon = config?.icon ?? (group.kind === 'task' ? ListChecks : FileText);

                return (
                    <div key={group.kind} data-testid={`search-group-${group.kind}`}>
                        {/* Group header */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${isLight ? 'bg-slate-50 text-slate-500' : 'bg-white/5 text-gray-500'}`}>
                            <Icon className="w-3.5 h-3.5" />
                            <span>{group.label ?? (config ? t(config.labelKey) : group.kind)}</span>
                            <span className={`ml-auto ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>
                                {group.results.length}
                            </span>
                        </div>

                        {/* Items */}
                        {group.results.map((item) => {
                            const pinned = pins[item.id] ?? item.pinned;
                            return (
                                <div
                                    key={item.id}
                                    className={`flex items-center transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'}`}
                                >
                                    <button
                                        onClick={() => handleClick(item)}
                                        className={`flex-1 text-left px-4 py-2 text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}
                                    >
                                        {item.title}
                                        {item.subtitle && (
                                            <>
                                                {' '}
                                                <span className={`ml-1 text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                    {item.subtitle}
                                                </span>
                                            </>
                                        )}
                                        {item.caption && (
                                            <>
                                                {' '}
                                                <span
                                                    data-testid="search-caption"
                                                    className={`ml-2 px-1.5 py-0.5 rounded text-[11px] ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-gray-500'}`}
                                                >
                                                    {item.caption}
                                                </span>
                                            </>
                                        )}
                                    </button>
                                    {pinned != null && (
                                        <button
                                            onClick={() => togglePin(item, pinned)}
                                            aria-pressed={pinned}
                                            aria-label={t(pinned ? 'unpinTask' : 'pinTask', { name: item.title })}
                                            title={t(pinned ? 'unpin' : 'pin')}
                                            className={`mr-2 p-1.5 rounded-md ${pinned ? 'text-blue-400' : isLight ? 'text-slate-400 hover:text-slate-700' : 'text-gray-500 hover:text-white'}`}
                                        >
                                            {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}
