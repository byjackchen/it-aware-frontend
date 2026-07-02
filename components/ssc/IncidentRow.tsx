'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { LinkIcon, BookOpen, Crosshair } from 'lucide-react';
import { updateIncidentReview } from '@/lib/api/exports';
import {
    INCIDENT_CATEGORIES,
    getIncidentCategoryLabel,
    type Incident,
    type WorkerContext,
} from '@/lib/types/objects';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShortTime(dateStr: string, timezone: string): string {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
    });
}

// ---------------------------------------------------------------------------
// Inline cell helpers
// ---------------------------------------------------------------------------

function InlineText({
    value,
    onCommit,
    disabled,
    placeholder,
}: {
    value: string;
    onCommit: (v: string) => void;
    disabled?: boolean;
    placeholder?: string;
}) {
    const [local, setLocal] = useState(value);
    useEffect(() => {
        setLocal(value);
    }, [value]);
    return (
        <input
            type="text"
            value={local}
            onChange={e => setLocal(e.target.value)}
            onBlur={() => { if (local !== value) onCommit(local); }}
            onKeyDown={e => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                if (e.key === 'Escape') { setLocal(value); (e.target as HTMLInputElement).blur(); }
            }}
            disabled={disabled}
            placeholder={placeholder}
            className="w-full text-xs px-1.5 py-0.5 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 hover:border-slate-400 dark:hover:border-white/30 focus:border-blue-500 dark:focus:border-blue-400 focus:bg-blue-50 dark:focus:bg-blue-900/20 outline-none transition-colors"
        />
    );
}

function ToggleButton({
    value,
    onCommit,
    disabled,
}: {
    value: boolean | null;
    onCommit: (v: boolean | null) => void;
    disabled?: boolean;
}) {
    // Tri-state cycle: null → true → false → null
    const next = value === null ? true : value === true ? false : null;
    const label = value === null ? '—' : value === true ? 'Y' : 'N';
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onCommit(next)}
            className="w-full text-xs px-1 py-0.5 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-700 dark:text-gray-200 hover:border-slate-400 dark:hover:border-white/30 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
        >
            {label}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Grid column template (shared with IncidentsPanel header)
// ---------------------------------------------------------------------------

export const INCIDENT_GRID_COLS =
    'grid-cols-[40px_90px_90px_80px_1fr_90px_80px_75px_80px_70px_70px_50px_60px_120px_60px_140px_60px]';

// ---------------------------------------------------------------------------
// Main row component
// ---------------------------------------------------------------------------

interface IncidentRowProps {
    incident: Incident;
    worker?: WorkerContext;
    catalogName?: string;
    isAligned: boolean;
    onAlign: () => void;
    onFocusInteractions: (oids: string[]) => void;
    onChange: (updated: Incident) => void;
}

export function IncidentRow({
    incident,
    worker,
    catalogName,
    isAligned,
    onAlign,
    onFocusInteractions,
    onChange,
}: IncidentRowProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';
    const t = useTranslations('SSCDashboard');
    const locale = useLocale();

    const [draft, setDraft] = useState({
        review_summary: incident.review_summary ?? '',
        review_needs_optimization: (incident.review_needs_optimization ?? null) as boolean | null,
        review_optimization_notes: incident.review_optimization_notes ?? '',
    });
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Sync draft when the underlying incident changes (e.g. parent reloaded)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- controlled sync of external prop
        setDraft({
            review_summary: incident.review_summary ?? '',
            review_needs_optimization: incident.review_needs_optimization ?? null,
            review_optimization_notes: incident.review_optimization_notes ?? '',
        });
    }, [
        incident.oid,
        incident.review_summary,
        incident.review_needs_optimization,
        incident.review_optimization_notes,
    ]);

    const persist = (
        patch: Partial<{
            review_summary: string | null;
            review_needs_optimization: boolean | null;
            review_optimization_notes: string | null;
            review_category: string | null;
            pre_ticket_interaction_oids: string[] | null;
            related_kb_article_oids: string[] | null;
            mark_completed: boolean | null;
        }>,
    ) => {
        startTransition(async () => {
            try {
                const updated = await updateIncidentReview(incident.oid, patch);
                onChange(updated);
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Save failed');
            }
        });
    };

    // Display value: review_summary > fact > title
    const summaryDisplay = incident.review_summary ?? incident.fact ?? incident.title ?? '';

    // Pre-FAQ button: count + click handler
    const preFaqOids = incident.pre_ticket_interaction_oids ?? [];
    const preFaqCount = preFaqOids.length;

    // KB button: count + navigation
    const kbOids = incident.related_kb_article_oids ?? [];
    const kbCount = kbOids.length;

    const isCompleted = !!incident.review_completed_at;
    const pendingClass = isPending ? 'opacity-60' : '';
    const rowBg = isAligned ? (isLight ? 'bg-blue-50' : 'bg-blue-500/10') : '';

    const cellClass = `text-xs truncate ${isLight ? 'text-slate-700' : 'text-gray-300'}`;

    return (
        <div
            className={`grid ${INCIDENT_GRID_COLS} gap-1 px-3 py-1.5 border-b ${
                isLight ? 'border-slate-100' : 'border-white/5'
            } ${rowBg} ${pendingClass}`}
        >
            {/* 1. Align button */}
            <div>
                <button
                    type="button"
                    onClick={onAlign}
                    className={`px-1 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        isAligned
                            ? 'bg-blue-500 text-white'
                            : isLight
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                    title={t('buttons.align')}
                >
                    <Crosshair className="w-3 h-3 inline" />
                </button>
            </div>

            {/* 2. Time */}
            <div className={`text-xs ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                {formatShortTime(incident.effective_at, timezone)}
            </div>

            {/* 3. Ticket ID */}
            <div className={`text-xs font-mono truncate ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                <a
                    href={`/data/incidents/${incident.oid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`hover:underline ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}
                >
                    {incident.stable_id ?? '—'}
                </a>
            </div>

            {/* 4. SN Tags — read-only */}
            <div className={cellClass} title={incident.sys_tags ?? ''}>
                {incident.sys_tags ?? '—'}
            </div>

            {/* 5. Summary (editable — review_summary > fact > title display, edits go to review_summary) */}
            <div className={`text-xs ${isLight ? 'text-slate-700' : 'text-gray-300'}`} title={summaryDisplay}>
                <InlineText
                    value={draft.review_summary || summaryDisplay}
                    onCommit={v => {
                        const val = v.trim() || null;
                        setDraft(d => ({ ...d, review_summary: val ?? '' }));
                        persist({ review_summary: val });
                    }}
                    disabled={isPending}
                    placeholder={t('headers.summary')}
                />
            </div>

            {/* 5. Category */}
            <div className={cellClass} title={catalogName ?? incident.service_catalog_oid ?? ''}>
                {catalogName ?? '—'}
            </div>

            {/* 6. Actor — Phase 3 typed actor: fall back to stable_id when
                 actor_oid is null (external) or not in workerMap (system/agent). */}
            <div className={`text-xs truncate font-medium ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`} title={incident.actor_oid ?? incident.actor_stable_id ?? ''}>
                {worker?.stable_id ?? incident.actor_stable_id ?? incident.actor_oid ?? '—'}
            </div>

            {/* 7. AI Category — read-only label */}
            <div className={`text-xs truncate ${isLight ? 'text-slate-600' : 'text-gray-400'}`}
                 title={incident.ai_category_reason ?? undefined}>
                {incident.ai_category
                    ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'
                    }`}>{getIncidentCategoryLabel(incident.ai_category, locale)}</span>
                    : '—'}
            </div>

            {/* 8. Review Category — editable select (human override) */}
            <div className={`text-xs ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                <select
                    value={incident.review_category ?? ''}
                    onChange={e => {
                        const val = e.target.value || null;
                        persist({ review_category: val });
                    }}
                    disabled={isPending}
                    className="w-full text-[10px] px-1 py-0.5 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-700 dark:text-gray-200 hover:border-slate-400 dark:hover:border-white/30 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors cursor-pointer"
                >
                    <option value="" className="bg-white dark:bg-slate-800">—</option>
                    {INCIDENT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-white dark:bg-slate-800">
                            {getIncidentCategoryLabel(cat, locale)}
                        </option>
                    ))}
                </select>
            </div>

            {/* 9. Pre-FAQ button */}
            <div className="flex items-center justify-center">
                <button
                    type="button"
                    disabled={preFaqCount === 0}
                    onClick={() => preFaqCount > 0 && onFocusInteractions(preFaqOids)}
                    className={
                        preFaqCount > 0
                            ? 'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300'
                            : 'text-xs text-gray-400'
                    }
                    title={
                        preFaqCount > 0
                            ? t('buttons.preFaqWithCount', { count: preFaqCount })
                            : t('buttons.preFaqEmpty')
                    }
                >
                    <LinkIcon className="w-3 h-3" />
                    {preFaqCount > 0 && <span>{preFaqCount}</span>}
                </button>
            </div>

            {/* 8. KB button */}
            <div className="flex items-center justify-center">
                <button
                    type="button"
                    disabled={kbCount === 0}
                    onClick={() => kbCount > 0 && window.open(`/data/articles?focus=${kbOids.join(',')}`, '_blank')}
                    className={
                        kbCount > 0
                            ? 'flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'text-xs text-gray-400'
                    }
                    title={
                        kbCount > 0
                            ? t('buttons.kbWithCount', { count: kbCount })
                            : t('buttons.kbEmpty')
                    }
                >
                    <BookOpen className="w-3 h-3" />
                    {kbCount > 0 && <span>{kbCount}</span>}
                </button>
            </div>

            {/* 9. CSAT Score — read-only (sourced upstream) */}
            <div className={`${cellClass} text-center`}>
                {incident.csat_score ?? '—'}
            </div>

            {/* 10. CSAT Text — read-only (sourced upstream) */}
            <div className={cellClass} title={incident.csat_text ?? ''}>
                {incident.csat_text ?? '—'}
            </div>

            {/* 11. QA Score — read-only */}
            <div className={`${cellClass} text-center font-medium`}>
                {incident.qa_score ?? '—'}
            </div>

            {/* 11. 优化? — editable tri-state toggle */}
            <div className={`text-xs ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                <ToggleButton
                    value={draft.review_needs_optimization}
                    onCommit={v => {
                        setDraft(d => ({ ...d, review_needs_optimization: v }));
                        persist({ review_needs_optimization: v });
                    }}
                    disabled={isPending}
                />
            </div>

            {/* 12. 优化备注 — editable inline text */}
            <div className={`text-xs ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                <InlineText
                    value={draft.review_optimization_notes}
                    onCommit={v => {
                        const val = v.trim() || null;
                        setDraft(d => ({ ...d, review_optimization_notes: val ?? '' }));
                        persist({ review_optimization_notes: val });
                    }}
                    disabled={isPending}
                    placeholder={t('headers.optimizationNotes')}
                />
            </div>

            {/* 13. 完成 — toggle mark_completed */}
            <div className="text-xs text-center">
                <button
                    type="button"
                    disabled={isPending}
                    onClick={() => persist({ mark_completed: !isCompleted })}
                    title={isCompleted ? (incident.review_completed_at ?? undefined) : undefined}
                    className={`w-full px-1 rounded text-xs transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                        isCompleted
                            ? isLight ? 'text-green-600 font-semibold' : 'text-green-400 font-semibold'
                            : isLight ? 'text-slate-400' : 'text-gray-600'
                    }`}
                >
                    {isCompleted ? '✓' : '—'}
                </button>
            </div>

            {/* Inline error indicator */}
            {error && (
                <div className="col-span-15 text-[10px] text-red-500 px-1 truncate" title={error}>
                    {error}
                </div>
            )}
        </div>
    );
}
