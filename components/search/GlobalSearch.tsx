'use client';

/**
 * The search bar in the middle of the top bar: a large box and, under it, a
 * wider panel with the results (SearchResults). The arrow keys move through
 * every result, Enter opens the one they are on, Esc closes (from the box or
 * from inside the panel); "/" puts the cursor in the box from anywhere on the
 * page. The box is a combobox whose listbox is the panel.
 */

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X } from 'lucide-react';
import { setTaskPinned } from '@/app/actions/tasks';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { sections, step } from '@/lib/search/sections';
import { pageHref } from '@/lib/tasks/catalog';
import type { SearchResult } from '@/lib/types/search';
import { useSearch } from './useSearch';
import { RESULTS_ID, SearchResults, hitId } from './SearchResults';

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
        failed,
        isOpen,
        setIsOpen,
        setPinned,
        clear,
    } = useSearch({ debounceMs: 300, minLength: 2 });
    // A pin could not be changed: the panel says so until the query changes.
    const [pinFailed, setPinFailed] = useState(false);

    const found = sections(results);
    // Where the arrow keys are; typing puts them back on the first result.
    const [cursor, setActive] = useState(0);
    const active = cursor < found.flat.length ? cursor : 0;

    const ask = (typed: string) => {
        setQuery(typed);
        setActive(0);
        setPinFailed(false);
    };

    const empty = () => {
        clear();
        setActive(0);
        setPinFailed(false);
    };

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

    // "/" anywhere outside a field puts the cursor in the box, unless the page already used the key.
    useEffect(() => {
        const handleSlash = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement;
            if (event.key !== '/' || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
            if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
            if (['textbox', 'searchbox', 'combobox'].includes(target.getAttribute('role') ?? '')) return;
            event.preventDefault();
            inputRef.current?.focus();
        };
        document.addEventListener('keydown', handleSlash);
        return () => document.removeEventListener('keydown', handleSlash);
    }, []);

    const close = () => {
        empty();
        inputRef.current?.blur();
    };

    const open = (item: SearchResult) => {
        router.push(pageHref(item.opens));
        close();
    };

    /**
     * Pin or unpin a task from the panel. The results in hand show the pin at
     * once and keep it while the panel is closed and opened again; a pin that
     * fails is put back, and the panel says so.
     */
    const pin = async (item: SearchResult, pinned: boolean) => {
        setPinFailed(false);
        setPinned(item.id, pinned);
        const outcome = await setTaskPinned(item.id, pinned).catch(() => ({ error: 'failed' }));
        if ('error' in outcome) {
            setPinned(item.id, !pinned);
            setPinFailed(true);
        }
    };

    // As useSearch does, a query is what is left of it without the spaces around.
    const asked = query.trim().length >= 2;
    const showsPanel = isOpen && asked;
    const selectable = showsPanel && !isLoading && found.flat.length > 0;

    /** Esc closes from the box and from anywhere inside the panel (the pin buttons). */
    const handleEscape = (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') close();
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (!selectable) {
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
        if (asked && results.length > 0) {
            setIsOpen(true);
        }
    };

    return (
        <div ref={containerRef} onKeyDown={handleEscape} className="relative mx-auto min-w-0 max-w-[720px] flex-1">
            {/* Search input */}
            <div className="relative">
                <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => ask(e.target.value)}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={t('placeholder')}
                    aria-label={t('placeholder')}
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showsPanel}
                    aria-controls={selectable ? RESULTS_ID : undefined}
                    aria-activedescendant={selectable ? hitId(active) : undefined}
                    className="h-12 w-full rounded-full border-[1.5px] border-transparent bg-field pl-[3.25rem] pr-14 text-base text-ink placeholder:text-muted transition-all duration-200 focus:border-accent focus:bg-panel focus:shadow-[0_0_0_4px_var(--accent-soft)] focus:outline-none"
                />
                {query ? (
                    <button
                        onClick={empty}
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
                        failed={failed}
                        pinFailed={pinFailed}
                        active={active}
                        onActive={setActive}
                        onOpen={open}
                        onPin={pin}
                    />
                </div>
            )}
        </div>
    );
}
