'use client';

/**
 * Global search bar component.
 * Self-contained search UI with input and results dropdown.
 */

import { useRef, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useSearch } from './useSearch';
import { SearchResults } from './SearchResults';

export function GlobalSearch() {
    const { theme } = useTheme();
    const t = useTranslations('GlobalSearch');
    const isLight = theme === 'light';
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        query,
        setQuery,
        results,
        isLoading,
        isOpen,
        setIsOpen,
        clear,
    } = useSearch({ debounceMs: 300, minLength: 2 });

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [setIsOpen]);

    // Keyboard shortcuts
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            clear();
            inputRef.current?.blur();
        }
    }, [clear]);

    const handleFocus = () => {
        if (query.length >= 2 && results.length > 0) {
            setIsOpen(true);
        }
    };

    const handleSelect = () => {
        clear();
        inputRef.current?.blur();
    };

    return (
        <div ref={containerRef} className="relative w-96">
            {/* Search input */}
            <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={t('placeholder')}
                    className={`
                        w-full pl-9 pr-8 py-2 text-sm rounded-lg transition-all duration-200
                        ${isLight
                            ? 'bg-slate-100 text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/30'
                            : 'bg-white/10 text-white placeholder-gray-500 focus:bg-white/15 focus:ring-2 focus:ring-blue-500/30'
                        }
                        focus:outline-none
                    `}
                />
                {query && (
                    <button
                        onClick={clear}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Results dropdown */}
            {isOpen && query.length >= 2 && (
                <div className={`
                    absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border shadow-xl overflow-hidden
                    ${isLight ? 'bg-white border-slate-200' : 'bg-gray-800 border-white/10'}
                `}>
                    <SearchResults
                        results={results}
                        isLoading={isLoading}
                        onSelect={handleSelect}
                    />
                </div>
            )}
        </div>
    );
}
