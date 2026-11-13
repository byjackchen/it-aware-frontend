'use client';

/**
 * The search bar in the middle of the top bar: a large box and, under it, a
 * wider panel with the results (SearchResults). The arrow keys move through
 * every result, Enter opens the one they are on, Esc closes; "/" puts the
 * cursor in the box from anywhere on the page.
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { sections, step } from '@/lib/search/sections';
import { pageHref } from '@/lib/tasks/catalog';
import type { SearchGroup, SearchResult } from '@/lib/types/search';
import { useSearch } from './useSearch';
import { SearchResults } from './SearchResults';

export function GlobalSearch() {
    const t = useTranslations('GlobalSearch');
    const router = useTransitionRouter();
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

    const found = sections(results);
    // Where the arrow keys are, for the results it was set on: new results start at the first.
    const [cursor, setCursor] = useState<{ results: SearchGroup[]; index: number }>({ results, index: 0 });
    const active = cursor.results === results ? cursor.index : 0;
    const setActive = (index: number) => setCursor({ results, index });

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

    // "/" anywhere outside a field puts the cursor in the box.
    useEffect(() => {
        const handleSlash = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
            if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
            event.preventDefault();
            inputRef.current?.focus();
        };
        document.addEventListener('keydown', handleSlash);
        return () => document.removeEventListener('keydown', handleSlash);
    }, []);

    const close = () => {
        clear();
        inputRef.current?.blur();
    };

    const open = (item: SearchResult) => {
        router.push(pageHref(item.opens));
        close();
    };

    const showsPanel = isOpen && query.length >= 2;

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
            close();
        } else if (!showsPanel || isLoading || found.flat.length === 0) {
            return;
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(step(active, found.flat.length, event.key));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            open(found.flat[active]);
        }
    };

    const handleFocus = () => {
        if (query.length >= 2 && results.length > 0) {
            setIsOpen(true);
        }
    };

    return (
        <div ref={containerRef} className="relative mx-auto min-w-0 max-w-[720px] flex-1">
            {/* Search input */}
            <div className="relative">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={t('placeholder')}
                    aria-label={t('placeholder')}
                    className="h-12 w-full rounded-full border-[1.5px] border-transparent bg-field pl-[3.25rem] pr-14 text-base text-ink placeholder:text-muted transition-all duration-200 focus:border-accent focus:bg-panel focus:shadow-[0_0_0_4px_var(--accent-soft)] focus:outline-none"
                />
                {query ? (
                    <button
                        onClick={clear}
                        aria-label={t('clear')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted transition-colors hover:text-ink"
                    >
                        <X className="h-4 w-4" />
                    </button>
                ) : (
                    <kbd className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 rounded-md border border-line bg-panel px-1.5 py-px font-sans text-xs text-muted">/</kbd>
                )}
            </div>

            {/* The results panel, wider than the box */}
            {showsPanel && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2.5 overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_18px_50px_rgba(16,32,56,0.18)] lg:-left-[60px] lg:-right-[60px]">
                    <SearchResults
                        found={found}
                        query={query}
                        isLoading={isLoading}
                        active={active}
                        onActive={setActive}
                        onOpen={open}
                    />
                </div>
            )}
        </div>
    );
}
