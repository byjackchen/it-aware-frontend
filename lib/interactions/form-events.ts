/**
 * Software request form events on chatbot interactions (it-aware-backend
 * docs/activities/interaction_form_events.md). oit-chatbot records one event per
 * turn that touches a request; the closing turn (`form_final`) holds the final
 * submitted values.
 */

export type FormEvent =
    | 'started'
    | 'updated'
    | 'form_sent'
    | 'edit'
    | 'cancelled'
    | 'submitted'
    | 'failed'
    | 'dry_run'
    | 'progress';

export const FORM_EVENT_LABELS: Record<FormEvent, string> = {
    started: 'Started',
    updated: 'Details given',
    form_sent: 'Form sent',
    edit: 'Edit',
    cancelled: 'Cancelled',
    submitted: 'Submitted',
    failed: 'Failed',
    dry_run: 'Test mode (not sent)',
    progress: 'Progress checked',
};

/** What the list shows: every interaction, one row per form request, or every form turn. */
export type FormFilter = 'all' | 'requests' | 'turns';

export const FORM_FILTER_LABELS: Record<FormFilter, string> = {
    all: 'All interactions',
    requests: 'Form requests (one row each)',
    turns: 'All form turns',
};

/** The list API parameters for a form filter. */
export function formFilterQuery(filter: FormFilter): Record<string, string> {
    if (filter === 'requests') return { form_final: 'true' };
    if (filter === 'turns') return { has_form: 'true' };
    return {};
}

export interface FormFields {
    form_event?: string | null;
    form_item_name?: string | null;
    form_ticket_number?: string | null;
}

export function formEventLabel(event: string | null | undefined): string {
    if (!event) return '';
    return FORM_EVENT_LABELS[event as FormEvent] ?? event;
}

/** The row badge, e.g. "Jira · Submitted · RITM0012345"; null on a turn without a form event. */
export function formBadge(fields: FormFields): string | null {
    if (!fields.form_event) return null;
    return [fields.form_item_name, formEventLabel(fields.form_event), fields.form_ticket_number]
        .filter((part): part is string => Boolean(part))
        .join(' · ');
}

export interface FormValueRow {
    name: string;
    label: string;
    shown: string;
    value: string;
    cycleId: string | null;
}

function asText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return typeof value === 'string' ? value : JSON.stringify(value);
}

/** The submitted (or given) values as table rows, in label order. */
export function formValueRows(values: Record<string, unknown> | null | undefined): FormValueRow[] {
    if (!values) return [];
    return Object.entries(values)
        .map(([name, raw]) => {
            const entry = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : { value: raw };
            const value = asText(entry.value);
            return {
                name,
                label: asText(entry.label) || name,
                shown: asText(entry.display) || value,
                value,
                cycleId: entry.cycle_id ? asText(entry.cycle_id) : null,
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label));
}
