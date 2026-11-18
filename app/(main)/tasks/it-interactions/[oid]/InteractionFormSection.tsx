'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FileCheck2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { formEventsLabel, formTurnDetail, formValueRows } from '@/lib/interactions/form-events';
import type { Interaction, InteractionListResponse } from '@/lib/types/objects';

/**
 * The form event of a chatbot turn (any form kind; software requests first):
 * which form, what happened,
 * the values (on the closing turn, exactly what was submitted), and every other
 * turn of the same request. Renders nothing on a turn without a form event.
 */
export function InteractionFormSection({ interaction }: { interaction: Interaction }) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';
    const [turns, setTurns] = useState<Interaction[]>([]);
    const draftId = interaction.form_draft_id;

    useEffect(() => {
        if (!draftId) return;
        let cancelled = false;
        (async () => {
            try {
                const params = new URLSearchParams({
                    form_draft_id: draftId,
                    sort_by: 'created_at',
                    order: 'asc',
                    // full: each turn's events and reason are in content_raw
                    view: 'full',
                    limit: '100',
                });
                const res = await fetch(`/api/objects/interactions?${params}`, { credentials: 'include' });
                if (!res.ok) return;
                const payload = (await res.json()) as InteractionListResponse;
                if (!cancelled) setTurns(payload.items ?? []);
            } catch {
                // Non-fatal: the timeline stays empty.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [draftId]);

    if (!interaction.form_event) return null;
    const rows = formValueRows(interaction.form_values);
    const detail = formTurnDetail(interaction.content_raw);
    const muted = isLight ? 'text-slate-500' : 'text-gray-500';
    return (
        <div
            data-testid="interaction-form-section"
            className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}
        >
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                <FileCheck2 className="w-4 h-4" /> Form
            </h3>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                    <dt className={muted}>Form</dt>
                    <dd data-testid="interaction-form-item">{interaction.form_item_name || '—'}</dd>
                </div>
                <div>
                    <dt className={muted}>Event</dt>
                    <dd data-testid="interaction-form-event">
                        {formEventsLabel(detail.events, interaction.form_event)}
                        {interaction.form_final ? ' (final)' : ''}
                    </dd>
                </div>
                <div>
                    <dt className={muted}>Ticket</dt>
                    <dd>{interaction.form_ticket_number || '—'}</dd>
                </div>
                <div>
                    <dt className={muted}>Request</dt>
                    <dd className="font-mono text-xs break-all">{draftId || '—'}</dd>
                </div>
            </dl>
            {detail.error && (
                <p data-testid="interaction-form-error" className={`text-sm ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                    Reason: {detail.error}
                </p>
            )}
            {rows.length > 0 && (
                <table className="w-full text-sm" data-testid="interaction-form-values">
                    <thead>
                        <tr className={muted}>
                            <th className="text-left font-medium py-1">{interaction.form_final ? 'Submitted field' : 'Field'}</th>
                            <th className="text-left font-medium py-1">Value</th>
                            <th className="text-left font-medium py-1">Stored as</th>
                            <th className="text-left font-medium py-1">Given in turn</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.name} className={`border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                                <td className="py-1 pr-3">{row.label}</td>
                                <td className="py-1 pr-3">{row.shown}</td>
                                <td className={`py-1 pr-3 font-mono text-xs ${muted}`}>{row.value}</td>
                                <td className={`py-1 font-mono text-xs ${muted}`}>{row.cycleId || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {turns.length > 0 && (
                <div>
                    <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${muted}`}>Turns of this request</div>
                    <ol className="space-y-1 text-sm" data-testid="interaction-form-turns">
                        {turns.map((turn) => {
                            const turnDetail = formTurnDetail(turn.content_raw);
                            const label = formEventsLabel(turnDetail.events, turn.form_event);
                            return (
                                <li key={turn.oid} className="flex flex-wrap gap-x-3">
                                    <span className={muted}>{formatDateTime(turn.created_at, timezone)}</span>
                                    {turn.oid === interaction.oid ? (
                                        <span className="font-medium">{label} (this turn)</span>
                                    ) : (
                                        <Link className="text-indigo-500 hover:underline" href={`/tasks/it-interactions/${turn.oid}`}>
                                            {label}
                                        </Link>
                                    )}
                                    {turnDetail.error && (
                                        <span className={isLight ? 'text-amber-700' : 'text-amber-300'}>Reason: {turnDetail.error}</span>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </div>
            )}
        </div>
    );
}
