'use client';

/**
 * Read-only "ServiceNow Lifecycle & SLA" card for the incident +
 * request data detail pages.
 *
 * Every field here is populated by the sync DAG from SN's
 * authoritative payload. Editing locally is pointless — the next sync
 * would overwrite — so this card is display-only. For audit /
 * debugging, the card surfaces what SN told us about this row.
 *
 * See backend docs/activities/timestamp_semantics.md.
 */

import type { ReactNode } from 'react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';

type SourceSlice = {
    // Lifecycle timestamps.
    source_created_at?: string | null;
    source_updated_at?: string | null;
    source_opened_at?: string | null;
    source_resolved_at?: string | null;
    source_closed_at?: string | null;
    source_last_reopened_at?: string | null;
    source_sla_due?: string | null;
    source_due_date?: string | null;
    source_expected_start?: string | null;
    source_agent_updated_at?: string | null;

    // Display-name actors.
    opened_by_name?: string | null;
    resolved_by_name?: string | null;
    closed_by_name?: string | null;
    last_reopened_by_name?: string | null;

    // Ticket-anchored dimensions.
    location?: string | null;
    department?: string | null;
    company?: string | null;

    // Service / CMDB linkage.
    service?: string | null;
    service_offering?: string | null;
    configuration_item_display?: string | null;
    catalog?: string | null;

    // SLA / escalation.
    made_sla?: boolean | null;
    escalation?: number | null;
    severity?: string | null;
    reopen_count?: number | null;
    reassignment_count?: number | null;

    // Durations (seconds).
    business_duration_sec?: number | null;
    business_resolve_time_sec?: number | null;
    business_duration_w_pause_sec?: number | null;
    duration_sec?: number | null;
    resolve_time_sec?: number | null;

    // Resolution detail.
    on_hold_reason?: string | null;
    resolution_code?: string | null;
    resolution_notes?: string | null;
    close_notes?: string | null;

    // Correlation.
    correlation_id?: string | null;
    correlation_display?: string | null;

    // Relationship / causation (SN IDs).
    parent_incident_sn_id?: string | null;
    parent_sn_id?: string | null;
    child_incidents_sn_ids?: string[] | null;
    change_request_sn_id?: string | null;
    caused_by_change_sn_id?: string | null;
    problem_sn_id?: string | null;
    probable_cause?: string | null;
    knowledge_sn_id?: string | null;

    // Request-only.
    contact_type?: string | null;
    request_sn_id?: string | null;
};

export interface Phase2FieldsCardProps {
    data: SourceSlice;
    /** Incident-specific fields vary slightly from request-specific. */
    variant: 'incident' | 'request';
}

/** Format seconds → "1d 21h 15m" or "45m 30s". Null → em-dash. */
function formatDuration(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined) return '—';
    if (seconds === 0) return '0s';
    const abs = Math.abs(seconds);
    const days = Math.floor(abs / 86400);
    const hours = Math.floor((abs % 86400) / 3600);
    const mins = Math.floor((abs % 3600) / 60);
    const secs = abs % 60;
    const parts: string[] = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (mins && days === 0) parts.push(`${mins}m`);
    if (secs && days === 0 && hours === 0) parts.push(`${secs}s`);
    return parts.join(' ') || '0s';
}

function formatBool(value: boolean | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return value ? 'Yes' : 'No';
}

function formatText(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    const s = String(value).trim();
    return s || '—';
}

export function Phase2FieldsCard({ data, variant }: Phase2FieldsCardProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';

    const cardCls = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';
    const headerCls = isLight ? 'text-slate-800' : 'text-white';
    const labelCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const valueCls = isLight ? 'text-slate-700' : 'text-gray-200';
    const pillCls = isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-200';
    const sectionHeaderCls = isLight ? 'text-slate-600' : 'text-gray-300';
    const dividerCls = isLight ? 'border-slate-200' : 'border-white/10';

    const Field = ({ label, children }: { label: string; children: ReactNode }) => (
        <div>
            <span className={`block text-xs font-semibold uppercase tracking-wider mb-1 ${labelCls}`}>
                {label}
            </span>
            <span className={`text-sm ${valueCls}`}>{children}</span>
        </div>
    );

    const SectionHeader = ({ children }: { children: ReactNode }) => (
        <h3 className={`text-xs font-semibold uppercase tracking-wider ${sectionHeaderCls} mt-2 mb-3`}>
            {children}
        </h3>
    );

    return (
        <div className={`rounded-xl border p-6 space-y-6 ${cardCls}`}>
            <div className="flex items-center justify-between">
                <h2 className={`text-lg font-semibold ${headerCls}`}>ServiceNow Lifecycle &amp; SLA</h2>
                <span className={`text-xs px-2 py-1 rounded ${pillCls}`}>read-only · source of truth: ServiceNow</span>
            </div>

            {/* Upstream lifecycle timestamps */}
            <div>
                <SectionHeader>Lifecycle (upstream timestamps)</SectionHeader>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Source Created">{formatDateTime(data.source_created_at, timezone)}</Field>
                    <Field label="Source Updated (aging clock)">
                        {formatDateTime(data.source_updated_at, timezone)}
                    </Field>
                    <Field label="Opened">{formatDateTime(data.source_opened_at, timezone)}</Field>
                    {variant === 'incident' && (
                        <Field label="Resolved">{formatDateTime(data.source_resolved_at, timezone)}</Field>
                    )}
                    <Field label="Closed">{formatDateTime(data.source_closed_at, timezone)}</Field>
                    {variant === 'incident' && (
                        <Field label="Last Reopened">
                            {formatDateTime(data.source_last_reopened_at, timezone)}
                        </Field>
                    )}
                    <Field label="SLA Due">{formatDateTime(data.source_sla_due, timezone)}</Field>
                    <Field label="Due Date">{formatDateTime(data.source_due_date, timezone)}</Field>
                    <Field label="Expected Start">{formatDateTime(data.source_expected_start, timezone)}</Field>
                    {variant === 'request' && (
                        <Field label="Agent Updated">{formatDateTime(data.source_agent_updated_at, timezone)}</Field>
                    )}
                </div>
            </div>

            {/* Display-name actors */}
            <div className={`pt-4 border-t border-dashed ${dividerCls}`}>
                <SectionHeader>Actors (SN display names)</SectionHeader>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Field label="Opened By">{formatText(data.opened_by_name)}</Field>
                    {variant === 'incident' && (
                        <Field label="Resolved By">{formatText(data.resolved_by_name)}</Field>
                    )}
                    <Field label="Closed By">{formatText(data.closed_by_name)}</Field>
                    {variant === 'incident' && (
                        <Field label="Last Reopened By">{formatText(data.last_reopened_by_name)}</Field>
                    )}
                </div>
            </div>

            {/* SLA + escalation */}
            <div className={`pt-4 border-t border-dashed ${dividerCls}`}>
                <SectionHeader>SLA &amp; Escalation</SectionHeader>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Field label="Made SLA">{formatBool(data.made_sla)}</Field>
                    <Field label="Escalation">{formatText(data.escalation)}</Field>
                    {variant === 'incident' && (
                        <Field label="Severity">{formatText(data.severity)}</Field>
                    )}
                    {variant === 'incident' && (
                        <Field label="Reopen Count">{formatText(data.reopen_count)}</Field>
                    )}
                    <Field label="Reassignment Count">{formatText(data.reassignment_count)}</Field>
                </div>
            </div>

            {/* Durations */}
            <div className={`pt-4 border-t border-dashed ${dividerCls}`}>
                <SectionHeader>Durations</SectionHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Business Duration">{formatDuration(data.business_duration_sec)}</Field>
                    {variant === 'incident' && (
                        <Field label="Business Resolve Time">
                            {formatDuration(data.business_resolve_time_sec)}
                        </Field>
                    )}
                    <Field label="Business Duration (w/ pause)">
                        {formatDuration(data.business_duration_w_pause_sec)}
                    </Field>
                    <Field label="Duration">{formatDuration(data.duration_sec)}</Field>
                    <Field label="Resolve Time">{formatDuration(data.resolve_time_sec)}</Field>
                </div>
            </div>

            {/* Ticket-anchored dimensions */}
            <div className={`pt-4 border-t border-dashed ${dividerCls}`}>
                <SectionHeader>Location &amp; Organization (ticket-anchored)</SectionHeader>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Location">{formatText(data.location)}</Field>
                    <Field label="Department">{formatText(data.department)}</Field>
                    <Field label="Company">{formatText(data.company)}</Field>
                </div>
            </div>

            {/* Service / CMDB */}
            <div className={`pt-4 border-t border-dashed ${dividerCls}`}>
                <SectionHeader>Service &amp; CMDB</SectionHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Service">{formatText(data.service)}</Field>
                    <Field label="Service Offering">{formatText(data.service_offering)}</Field>
                    <Field label="Configuration Item">{formatText(data.configuration_item_display)}</Field>
                    {variant === 'request' && (
                        <>
                            <Field label="Catalog">{formatText(data.catalog)}</Field>
                            <Field label="Contact Type">{formatText(data.contact_type)}</Field>
                        </>
                    )}
                </div>
            </div>

            {/* Resolution / on-hold detail */}
            <div className={`pt-4 border-t border-dashed ${dividerCls}`}>
                <SectionHeader>Resolution Detail</SectionHeader>
                <div className="space-y-3">
                    {variant === 'incident' && (
                        <>
                            <Field label="On Hold Reason">{formatText(data.on_hold_reason)}</Field>
                            <Field label="Resolution Code">{formatText(data.resolution_code)}</Field>
                            <Field label="Resolution Notes">
                                <span className="whitespace-pre-wrap">{formatText(data.resolution_notes)}</span>
                            </Field>
                            <Field label="Probable Cause">
                                <span className="whitespace-pre-wrap">{formatText(data.probable_cause)}</span>
                            </Field>
                        </>
                    )}
                    {variant === 'request' && (
                        <Field label="Close Notes">
                            <span className="whitespace-pre-wrap">{formatText(data.close_notes)}</span>
                        </Field>
                    )}
                </div>
            </div>

            {/* Correlation + SN links */}
            <div className={`pt-4 border-t border-dashed ${dividerCls}`}>
                <SectionHeader>Correlation &amp; SN Links</SectionHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Correlation ID">
                        <span className="font-mono text-xs">{formatText(data.correlation_id)}</span>
                    </Field>
                    <Field label="Correlation Display">{formatText(data.correlation_display)}</Field>
                    {variant === 'incident' && (
                        <Field label="Parent Incident">
                            <span className="font-mono text-xs">{formatText(data.parent_incident_sn_id)}</span>
                        </Field>
                    )}
                    <Field label="Parent">
                        <span className="font-mono text-xs">{formatText(data.parent_sn_id)}</span>
                    </Field>
                    {variant === 'incident' && (
                        <Field label="Child Incidents">
                            <span className="font-mono text-xs">
                                {data.child_incidents_sn_ids && data.child_incidents_sn_ids.length > 0
                                    ? data.child_incidents_sn_ids.join(', ')
                                    : '—'}
                            </span>
                        </Field>
                    )}
                    {variant === 'incident' && (
                        <>
                            <Field label="Change Request">
                                <span className="font-mono text-xs">{formatText(data.change_request_sn_id)}</span>
                            </Field>
                            <Field label="Caused By Change">
                                <span className="font-mono text-xs">{formatText(data.caused_by_change_sn_id)}</span>
                            </Field>
                            <Field label="Problem">
                                <span className="font-mono text-xs">{formatText(data.problem_sn_id)}</span>
                            </Field>
                        </>
                    )}
                    {variant === 'request' && (
                        <Field label="Request (REQ)">
                            <span className="font-mono text-xs">{formatText(data.request_sn_id)}</span>
                        </Field>
                    )}
                    <Field label="Knowledge">
                        <span className="font-mono text-xs">{formatText(data.knowledge_sn_id)}</span>
                    </Field>
                </div>
            </div>
        </div>
    );
}
