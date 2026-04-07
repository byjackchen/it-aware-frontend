'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { updateInteractionReview } from '@/lib/api/exports';
import {
    REVIEW_CODES,
    type Interaction,
    type ReviewCode,
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

function renderHelpfulScore(score: number | null | undefined): string {
    if (score === null || score === undefined) return '—';
    if (score > 0) return '👍';
    if (score < 0) return '👎';
    return '•';
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
    // Sync local state when the committed value changes externally (e.g. after a save)
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

function InlineSelect<T extends string>({
    value,
    options,
    onCommit,
    disabled,
    optionLabel,
}: {
    value: T | null;
    options: readonly T[];
    onCommit: (v: T | null) => void;
    disabled?: boolean;
    optionLabel?: (v: T) => string;
}) {
    return (
        <select
            value={value ?? ''}
            onChange={e => onCommit((e.target.value as T) || null)}
            disabled={disabled}
            className="w-full text-xs px-1 py-0.5 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 text-slate-700 dark:text-gray-200 hover:border-slate-400 dark:hover:border-white/30 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-colors cursor-pointer"
        >
            <option value="" className="bg-white dark:bg-slate-800">—</option>
            {options.map(opt => (
                <option key={opt} value={opt} className="bg-white dark:bg-slate-800">{optionLabel ? optionLabel(opt) : opt}</option>
            ))}
        </select>
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
// Main row component
// ---------------------------------------------------------------------------

const GRID_COLS =
    'grid-cols-[100px_90px_70px_70px_100px_1fr_1fr_80px_80px_60px_70px_70px_60px_140px_60px]';

interface InteractionRowProps {
    interaction: Interaction;
    worker?: WorkerContext;
    isAligned: boolean;
    inWindow: boolean;
    isFocused: boolean;
    onChange: (updated: Interaction) => void;
    rowRef?: React.RefObject<HTMLDivElement | null>;
}

export function InteractionRow({
    interaction,
    worker,
    isAligned,
    inWindow,
    isFocused,
    onChange,
    rowRef,
}: InteractionRowProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';
    const t = useTranslations('SSCDashboard');

    const [draft, setDraft] = useState({
        review_ci: interaction.review_ci ?? '',
        review_code: (interaction.review_code ?? null) as ReviewCode | null,
        review_needs_optimization: (interaction.review_needs_optimization ?? null) as boolean | null,
        review_optimization_notes: interaction.review_optimization_notes ?? '',
    });
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    // Sync draft when the underlying interaction changes (e.g. parent reloaded)
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- controlled sync of external prop
        setDraft({
            review_ci: interaction.review_ci ?? '',
            review_code: interaction.review_code ?? null,
            review_needs_optimization: interaction.review_needs_optimization ?? null,
            review_optimization_notes: interaction.review_optimization_notes ?? '',
        });
    }, [
        interaction.oid,
        interaction.review_ci,
        interaction.review_code,
        interaction.review_needs_optimization,
        interaction.review_optimization_notes,
    ]);

    const persist = (
        patch: Partial<{
            review_ci: string | null;
            review_code: ReviewCode | null;
            review_needs_optimization: boolean | null;
            review_optimization_notes: string | null;
            mark_completed: boolean | null;
        }>,
    ) => {
        startTransition(async () => {
            try {
                const updated = await updateInteractionReview(interaction.oid, patch);
                onChange(updated);
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Save failed');
            }
        });
    };

    // Row background
    let rowBg = '';
    let borderLeft = '';
    if (isFocused) {
        rowBg = isLight ? 'bg-purple-100' : 'bg-purple-500/20';
        borderLeft = 'border-l-4 border-l-purple-500';
    } else if (isAligned) {
        rowBg = isLight ? 'bg-blue-50' : 'bg-blue-500/15';
        borderLeft = 'border-l-4 border-l-blue-500';
    } else if (inWindow) {
        rowBg = isLight ? 'bg-blue-50/50' : 'bg-blue-500/8';
        borderLeft = 'border-l-4 border-l-blue-500/40';
    }

    const cellClass = `text-xs truncate ${isLight ? 'text-slate-700' : 'text-gray-300'}`;
    const pendingClass = isPending ? 'opacity-60' : '';

    const isCompleted = !!interaction.review_completed_at;

    return (
        <div
            ref={rowRef}
            className={`grid ${GRID_COLS} gap-1 px-3 py-1.5 border-b ${
                isLight ? 'border-slate-100' : 'border-white/5'
            } ${rowBg} ${borderLeft} ${pendingClass}`}
        >
            {/* 1. Time */}
            <div className={`text-xs ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                {formatShortTime(interaction.created_at, timezone)}
            </div>

            {/* 2. User */}
            <div className={`text-xs truncate font-medium ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`}>
                {interaction.actor_stable_id}
            </div>

            {/* 3. Region */}
            <div className={cellClass}>{worker?.region ?? '—'}</div>

            {/* 4. Country */}
            <div className={cellClass}>{worker?.country ?? '—'}</div>

            {/* 5. Department */}
            <div className={cellClass} title={worker?.department ?? ''}>
                {worker?.department ?? '—'}
            </div>

            {/* 6. Question */}
            <div className={cellClass} title={interaction.content_text ?? ''}>
                {interaction.content_text ?? '—'}
            </div>

            {/* 7. FAQ Reply */}
            <div className={cellClass} title={interaction.response_text ?? ''}>
                {interaction.response_text ?? '—'}
            </div>

            {/* 8. CI (AI) — read-only */}
            <div className={cellClass}>{interaction.ai_ci ?? '—'}</div>

            {/* 9. CI (Review) — editable inline text */}
            <div className={`text-xs ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                <InlineText
                    value={draft.review_ci}
                    onCommit={v => {
                        const val = v.trim() || null;
                        setDraft(d => ({ ...d, review_ci: val ?? '' }));
                        persist({ review_ci: val });
                    }}
                    disabled={isPending}
                    placeholder={t('headers.ciReview')}
                />
            </div>

            {/* 10. Helpful */}
            <div className={`text-xs text-center ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                {renderHelpfulScore(interaction.helpful_score)}
            </div>

            {/* 11. Code (AI) — read-only */}
            <div className={cellClass}>{interaction.ai_code ?? '—'}</div>

            {/* 12. Code (Review) — editable inline select */}
            <div className={`text-xs ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                <InlineSelect<ReviewCode>
                    value={draft.review_code}
                    options={REVIEW_CODES}
                    onCommit={v => {
                        setDraft(d => ({ ...d, review_code: v }));
                        persist({ review_code: v });
                    }}
                    disabled={isPending}
                    optionLabel={v => t(`codes.${v}`)}
                />
            </div>

            {/* 13. 优化? — editable toggle */}
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

            {/* 14. 优化备注 — editable inline text */}
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

            {/* 15. 完成 — toggle mark_completed */}
            <div className="text-xs text-center">
                <button
                    type="button"
                    disabled={isPending}
                    onClick={() => persist({ mark_completed: !isCompleted })}
                    title={isCompleted ? interaction.review_completed_at ?? undefined : undefined}
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
