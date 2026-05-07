'use client';

/**
 * Search results dropdown component.
 * Groups results by object type and renders clickable items.
 */

import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { SEARCH_CONFIG, getObjectDetailUrl } from '@/lib/config/search';
import type { RegistryEntry } from '@/lib/types/objects';

interface SearchResultsProps {
    results: RegistryEntry[];
    isLoading: boolean;
    onSelect: () => void;
}

interface GroupedResults {
    [objectType: string]: RegistryEntry[];
}

export function SearchResults({ results, isLoading, onSelect }: SearchResultsProps) {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const t = useTranslations('GlobalSearch');
    const isLight = theme === 'light';

    // Group results by object type
    const grouped = results.reduce<GroupedResults>((acc, item) => {
        if (!acc[item.object_type]) {
            acc[item.object_type] = [];
        }
        acc[item.object_type].push(item);
        return acc;
    }, {});

    const objectTypes = Object.keys(grouped);

    const handleClick = (item: RegistryEntry) => {
        const url = getObjectDetailUrl(item.object_type, item.oid);
        router.push(url);
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
        <div className="max-h-80 overflow-y-auto">
            {objectTypes.map((type) => {
                const config = SEARCH_CONFIG[type];
                if (!config) return null;

                const Icon = config.icon;
                const items = grouped[type];

                return (
                    <div key={type}>
                        {/* Group header */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium ${isLight ? 'bg-slate-50 text-slate-500' : 'bg-white/5 text-gray-500'}`}>
                            <Icon className="w-3.5 h-3.5" />
                            <span>{t(config.labelKey)}</span>
                            <span className={`ml-auto ${isLight ? 'text-slate-400' : 'text-gray-600'}`}>
                                {items.length}
                            </span>
                        </div>

                        {/* Items */}
                        {items.map((item) => (
                            <button
                                key={item.oid}
                                onClick={() => handleClick(item)}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-gray-200 hover:bg-white/5'}`}
                            >
                                {item.descriptor}
                            </button>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}
