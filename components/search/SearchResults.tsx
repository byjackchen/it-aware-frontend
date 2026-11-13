'use client';

/**
 * The search panel: two sections, Tasks first and then Objects (the records,
 * under a small heading per kind). Each result opens its page; a task shows
 * its grouping beside it and can be pinned to the home from here. The result
 * the arrow keys are on is marked, and the pointer moves it too.
 *
 * For assistive technology the panel is the listbox of the search box (a
 * combobox): each result is an option, the selected one named by the box's
 * aria-activedescendant (`hitId`).
 */

import { useTranslations } from 'next-intl';
import { FileText, Loader2, Star } from 'lucide-react';
import { TaskTile } from '@/components/tasks/TaskTile';
import { SEARCH_CONFIG } from '@/lib/config/search';
import { marked, type SearchSections } from '@/lib/search/sections';
import type { SearchResult } from '@/lib/types/search';

/** The id of the panel (the search box's aria-controls) and of the result at a place in it. */
export const RESULTS_ID = 'global-search-results';
export const hitId = (index: number) => `global-search-hit-${index}`;

interface SearchResultsProps {
    found: SearchSections;
    query: string;
    isLoading: boolean;
    /** The search request failed; nothing was found is a different thing. */
    failed: boolean;
    /** A pin could not be changed. */
    pinFailed: boolean;
    /** The place in `found.flat` the arrow keys are on. */
    active: number;
    onActive: (index: number) => void;
    onOpen: (item: SearchResult) => void;
    /** Pin or unpin a task; the results in hand carry the pin (`item.pinned`). */
    onPin: (item: SearchResult, pinned: boolean) => void;
}

export function SearchResults({ found, query, isLoading, failed, pinFailed, active, onActive, onOpen, onPin }: SearchResultsProps) {
    const t = useTranslations('GlobalSearch');

    if (isLoading) {
        return (
            <div className="flex items-center justify-center gap-2 py-6 text-ink-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">{t('searching')}</span>
            </div>
        );
    }

    if (failed) {
        return <div role="alert" data-testid="search-failed" className="py-6 text-center text-sm text-bad">{t('failed')}</div>;
    }

    if (found.flat.length === 0) {
        return <div className="py-6 text-center text-sm text-ink-2">{t('noResults')}</div>;
    }

    const mark = (text: string) =>
        marked(text, query).map((part, index) =>
            part.hit ? <mark key={index} className="rounded-[3px] bg-mark text-inherit">{part.text}</mark> : part.text
        );

    const hit = (item: SearchResult, kind: string) => {
        const index = found.flat.indexOf(item);
        const isActive = index === active;
        const pinned = item.pinned;
        const Icon = kind === 'task' ? null : SEARCH_CONFIG[kind]?.icon ?? FileText;
        return (
            <div
                key={`${kind}:${item.id}`}
                id={hitId(index)}
                role="option"
                aria-selected={isActive}
                data-testid="search-hit"
                data-active={isActive}
                ref={isActive ? element => element?.scrollIntoView({ block: 'nearest' }) : undefined}
                onMouseMove={() => { if (!isActive) onActive(index); }}
                className={`flex items-center rounded-[10px] ${isActive ? 'bg-accent-soft' : ''}`}
            >
                <button onClick={() => onOpen(item)} className="flex min-w-0 flex-1 items-center gap-3 px-2.5 py-2 text-left">
                    <TaskTile name={item.title} task={kind === 'task' ? item.id : undefined} small>{Icon && <Icon className="h-4 w-4" />}</TaskTile>
                    <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{mark(item.title)}</span>
                        {item.subtitle && (
                            <>
                                {' '}
                                <span className="block truncate text-xs text-muted">{mark(item.subtitle)}</span>
                            </>
                        )}
                    </span>
                    {item.caption && (
                        <>
                            {' '}
                            <span data-testid="search-caption" className="shrink-0 text-xs text-muted">{item.caption}</span>
                        </>
                    )}
                </button>
                {pinned != null && (
                    <button
                        onClick={() => onPin(item, !pinned)}
                        aria-pressed={pinned}
                        aria-label={t(pinned ? 'unpinTask' : 'pinTask', { name: item.title })}
                        title={t(pinned ? 'unpin' : 'pin')}
                        className={`mr-2 rounded-md p-1.5 ${pinned ? 'text-accent' : 'text-muted hover:text-ink'}`}
                    >
                        <Star className="h-4 w-4" fill={pinned ? 'currentColor' : 'none'} />
                    </button>
                )}
            </div>
        );
    };

    const heading = 'mb-2 flex items-baseline gap-2.5 text-[17px] font-semibold text-ink';
    return (
        <>
            {pinFailed && (
                <div role="alert" data-testid="search-pin-failed" className="border-b border-line px-5 py-2 text-sm text-bad">
                    {t('pinFailed')}
                </div>
            )}
            <div
                id={RESULTS_ID}
                role="listbox"
                aria-label={t('results')}
                className="max-h-[min(70vh,34rem)] overflow-y-auto"
                data-testid="search-results"
            >
                {found.tasks.length > 0 && (
                    <div role="group" aria-label={t('tasks')} className="px-5 pb-3 pt-3.5" data-testid="search-group-task">
                        <h3 className={heading}>
                            <span>{t('tasks')}</span>
                            <small className="text-xs font-medium text-muted">{t('tasksCount', { count: found.tasks.length })}</small>
                        </h3>
                        {found.tasks.map(item => hit(item, 'task'))}
                    </div>
                )}
                {found.objects.length > 0 && (
                    <div
                        className={`px-5 pb-3 pt-3.5 ${found.tasks.length > 0 ? 'border-t-8 border-page' : ''}`}
                        data-testid="search-objects"
                    >
                        <h3 className={heading}>
                            <span>{t('objects')}</span>
                            <small className="text-xs font-medium text-muted">{t('objectsHint')}</small>
                        </h3>
                        {found.objects.map(group => {
                            const config = SEARCH_CONFIG[group.kind];
                            const kind = group.label ?? (config ? t(config.labelKey) : group.kind);
                            return (
                                <div key={group.kind} role="group" aria-label={t('objectsOf', { kind })} data-testid={`search-group-${group.kind}`}>
                                    <h4 className="mx-2.5 mb-0.5 mt-2.5 text-xs uppercase tracking-wider text-muted">
                                        <span>{kind}</span>
                                        {' · '}
                                        <span>{group.results.length}</span>
                                    </h4>
                                    {group.results.map(item => hit(item, group.kind))}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="flex gap-4 border-t border-line bg-page px-5 py-2 text-xs text-muted">
                <span>↑↓ {t('keyMove')}</span>
                <span>↵ {t('keyOpen')}</span>
                <span>esc {t('keyClose')}</span>
            </div>
        </>
    );
}
