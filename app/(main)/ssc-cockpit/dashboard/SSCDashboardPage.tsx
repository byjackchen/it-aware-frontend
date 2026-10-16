'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutDashboard } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { SSCFilterBar } from '@/components/ssc/SSCFilterBar';
import { InteractionsPanel } from '@/components/ssc/InteractionsPanel';
import { IncidentsPanel } from '@/components/ssc/IncidentsPanel';
import { AlignmentStatusBar } from '@/components/ssc/AlignmentStatusBar';
import type { WorkerContext, Incident, Interaction } from '@/lib/types/objects';
import { formatLocalDateTime, localDateTimeToIso } from '@/lib/utils/datetime';
import { useTimezone } from '@/lib/contexts/timezone-context';

interface SSCDashboardPageProps {
    initialWorkerMap: Record<string, WorkerContext>;
    initialCatalogMap: Record<string, string>;
}

const ALIGN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

// TZ-aware defaults — the analyst's "today" is their local calendar day,
// not the UTC day. Each value is the wall-clock string consumed by
// `<input type="datetime-local">`: `YYYY-MM-DDTHH:MM:SS`. The dashboard
// composes ISO-with-offset at submission time via `localDateTimeToIso`.
function getDefaultDateFrom(timezone: string): string {
    const today = formatLocalDateTime(new Date(), timezone).slice(0, 10);
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    const dayPart = d.toISOString().slice(0, 10);
    // The day's first real instant: 01:00 where DST skips midnight.
    return formatLocalDateTime(new Date(localDateTimeToIso(`${dayPart}T00:00:00`, timezone)), timezone);
}

function getDefaultDateTo(timezone: string): string {
    // End of "today" in the analyst's calendar.
    const dayPart = formatLocalDateTime(new Date(), timezone).slice(0, 10);
    return `${dayPart}T23:59:59`;
}

/**
 * Find the interaction closest to (and before) the target timestamp.
 * Interactions must be sorted ascending by created_at.
 * Returns the oid of the best match, or null if none found in window.
 */
/**
 * Find the interaction closest to (and before) the target timestamp,
 * matching the given worker's stable_id.
 * Returns the oid of the best match, or null if none found in window.
 */
function findClosestInteraction(
    interactions: Interaction[],
    targetTs: number,
    windowStartTs: number,
    workerStableId?: string | null,
): string | null {
    // InteractionsPanel queries with order: 'desc', so index 0 is newest, length-1 is oldest.
    // Walk from newest → oldest. Skip items still ahead of the target; break once we
    // pass below the window start. The first qualifying row is the closest one ≤ target.
    let bestOid: string | null = null;
    for (let i = 0; i < interactions.length; i++) {
        const ts = new Date(interactions[i].created_at).getTime();
        if (ts > targetTs) continue;
        if (ts < windowStartTs) break;
        if (workerStableId && interactions[i].actor_stable_id !== workerStableId) continue;
        bestOid = interactions[i].oid;
        break;
    }
    return bestOid;
}

function SSCDashboardContent({ initialWorkerMap, initialCatalogMap }: SSCDashboardPageProps) {
    const { theme } = useTheme();
    const t = useTranslations('SSCDashboard');
    const isLight = theme === 'light';

    // Lookup maps from server-side props
    const workerMap = initialWorkerMap;
    const catalogMap = initialCatalogMap;

    // Single source of timezone truth for this page. Sourced from the
    // user's profile preference (set via the TopBar dropdown, persisted in
    // the user-data cookie) so changing the TZ there dynamically updates
    // every filter on the dashboard. Falls back to the browser-detected
    // zone when the user hasn't picked one yet.
    // See `docs/it_aware_merge_review.md` Appendix A rule #11.
    const { timezone } = useTimezone();

    // Filter state — computed in the analyst's local timezone
    const [dateFrom, setDateFrom] = useState(() => getDefaultDateFrom(timezone));
    const [dateTo, setDateTo] = useState(() => getDefaultDateTo(timezone));
    const [appliedDateFrom, setAppliedDateFrom] = useState(() => getDefaultDateFrom(timezone));
    const [appliedDateTo, setAppliedDateTo] = useState(() => getDefaultDateTo(timezone));
    const [workerFilter, setWorkerFilter] = useState('');
    const [appliedWorkerFilter, setAppliedWorkerFilter] = useState('');
    const [filterError, setFilterError] = useState<string | null>(null);

    // Alignment state
    const [alignedIncidentOid, setAlignedIncidentOid] = useState<string | null>(null);
    const [alignedIncidentStableId, setAlignedIncidentStableId] = useState<string>('');
    const [alignedWorkerStableId, setAlignedWorkerStableId] = useState<string | null>(null);
    const [highlightWindow, setHighlightWindow] = useState<{ start: number; end: number } | null>(null);
    const [alignedRowOid, setAlignedRowOid] = useState<string | null>(null);

    // Interactions panel date range — overridden during alignment
    const [interactionDateFrom, setInteractionDateFrom] = useState(() => getDefaultDateFrom(timezone));
    const [interactionDateTo, setInteractionDateTo] = useState(() => getDefaultDateTo(timezone));

    // Track interactions loaded by InteractionsPanel for alignment search
    const [interactionsRef, setInteractionsRef] = useState<Interaction[]>([]);

    // Focused interaction OIDs — driven by the Pre-FAQ button in IncidentsPanel
    const [focusedInteractionOids, setFocusedInteractionOids] = useState<Set<string> | null>(null);

    useEffect(() => {
        setAlignedIncidentOid(null);
        setAlignedWorkerStableId(null);
        setHighlightWindow(null);
        setAlignedRowOid(null);
        setFocusedInteractionOids(null);
        setInteractionDateFrom(appliedDateFrom);
        setInteractionDateTo(appliedDateTo);
        // The wall-clock filter remains selected; timezone alone changes the UTC window.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timezone]);

    const handleFocusInteractions = useCallback((oids: string[]) => {
        setFocusedInteractionOids(new Set(oids));
        // Clear browse-time alignment state so the highlight is unambiguous
        setAlignedIncidentOid(null);
        setHighlightWindow(null);
        setAlignedRowOid(null);
    }, []);

    // When interactions reload after alignment, find closest interaction and scroll
    useEffect(() => {
        if (highlightWindow && interactionsRef.length > 0 && !alignedRowOid) {
            const closestOid = findClosestInteraction(
                interactionsRef,
                highlightWindow.end,
                highlightWindow.start,
                alignedWorkerStableId,
            );
            if (closestOid) {
                setAlignedRowOid(closestOid);
            }
        }
    }, [interactionsRef, highlightWindow, alignedRowOid, alignedWorkerStableId]);

    const handleApplyFilters = useCallback(() => {
        try {
            if (dateFrom) localDateTimeToIso(dateFrom, timezone, 'earlier', 'reject');
            if (dateTo) localDateTimeToIso(dateTo, timezone, 'later', 'reject');
        } catch {
            setFilterError(t('messages.nonexistentTime', { timezone }));
            return;
        }
        setFilterError(null);
        setAppliedDateFrom(dateFrom);
        setAppliedDateTo(dateTo);
        setAppliedWorkerFilter(workerFilter);
        setInteractionDateFrom(dateFrom);
        setInteractionDateTo(dateTo);
        // Clear alignment when filters change
        setAlignedIncidentOid(null);
        setAlignedWorkerStableId(null);
        setHighlightWindow(null);
        setAlignedRowOid(null);
    }, [dateFrom, dateTo, workerFilter, timezone, t]);

    const handleAlign = useCallback((incident: Incident) => {
        const incidentTs = new Date(incident.effective_at).getTime();
        const windowStart = incidentTs - ALIGN_WINDOW_MS;

        // If clicking the same incident, toggle off — restore original date range
        if (alignedIncidentOid === incident.oid) {
            setAlignedIncidentOid(null);
            setAlignedWorkerStableId(null);
            setHighlightWindow(null);
            setAlignedRowOid(null);
            setInteractionDateFrom(appliedDateFrom);
            setInteractionDateTo(appliedDateTo);
            return;
        }

        // Resolve incident worker oid → stable_id for filtering interactions
        // Phase 3: actor_oid is null for external actors. Skip the workerMap
        // lookup when there's no oid (the panel falls back to actor_stable_id).
        const incidentWorkerStableId = incident.actor_oid
            ? workerMap[incident.actor_oid]?.stable_id ?? null
            : (incident.actor_stable_id ?? null);

        // Narrow interactions panel to the 30-min window so it fetches the right data.
        // Datetime-local strings (no offset) sit on the page state; the panel adds
        // the offset back at submission via `localDateTimeToIso`.
        const startLocal = formatLocalDateTime(new Date(windowStart), timezone);
        const endLocal = formatLocalDateTime(new Date(incidentTs + 30 * 60 * 1000), timezone);
        setInteractionDateFrom(startLocal);
        setInteractionDateTo(endLocal);

        setAlignedIncidentOid(incident.oid);
        setAlignedIncidentStableId(incident.stable_id ?? incident.oid);
        setAlignedWorkerStableId(incidentWorkerStableId);
        setHighlightWindow({ start: windowStart, end: incidentTs });
        setAlignedRowOid(null);
    }, [alignedIncidentOid, appliedDateFrom, appliedDateTo, workerMap, timezone]);

    const handleClearAlignment = useCallback(() => {
        setAlignedIncidentOid(null);
        setAlignedWorkerStableId(null);
        setHighlightWindow(null);
        setAlignedRowOid(null);
        setInteractionDateFrom(appliedDateFrom);
        setInteractionDateTo(appliedDateTo);
    }, [appliedDateFrom, appliedDateTo]);

    // A wall-clock value can be valid in one zone and disappear in another
    // during the spring DST change. Keep the filter controls available while
    // preventing either panel from converting an impossible applied range.
    let appliedRangeError: string | null = null;
    try {
        if (appliedDateFrom) localDateTimeToIso(appliedDateFrom, timezone, 'earlier', 'reject');
        if (appliedDateTo) localDateTimeToIso(appliedDateTo, timezone, 'later', 'reject');
    } catch {
        appliedRangeError = t('messages.nonexistentAppliedTime', { timezone });
    }

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400'
                    }`}>
                        <LayoutDashboard className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            SSC Dashboard
                        </h1>
                        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Chatbot interactions &amp; incidents timeline alignment
                        </p>
                    </div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="px-4">
                <SSCFilterBar
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    workerFilter={workerFilter}
                    timezone={timezone}
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                    onWorkerFilterChange={setWorkerFilter}
                    onApply={handleApplyFilters}
                />
                {filterError && <p role="alert" className="mb-3 text-sm text-red-400">{filterError}</p>}
            </div>

            {/* Stacked Panels — interactions above, incidents below.
                Stacked rather than side by side because the interactions grid
                carries 19 columns and has no horizontal scroller: side by side
                it only ever got a fraction of the viewport and the two 1fr
                columns (question / reply) absorbed the whole overflow.
                `min-h-0` on both children is load-bearing — a flex child
                defaults to min-height:auto, which would stop each panel's
                inner overflow-y-auto from ever scrolling. */}
            {appliedRangeError ? (
                <p role="alert" className="mx-4 text-sm text-red-400">{appliedRangeError}</p>
            ) : <div className={`flex-1 flex flex-col mx-4 mb-0 rounded-t-xl overflow-hidden border ${
                isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'
            }`}>
                {/* Top: Interactions */}
                <div className={`flex-1 min-h-0 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    <InteractionsPanel
                        dateFrom={interactionDateFrom}
                        dateTo={interactionDateTo}
                        workerFilter={appliedWorkerFilter}
                        highlightWindow={highlightWindow}
                        highlightWorkerStableId={alignedWorkerStableId}
                        alignedRowOid={alignedRowOid}
                        onItemsChange={setInteractionsRef}
                        workerMap={workerMap}
                        focusedInteractionOids={focusedInteractionOids}
                    />
                </div>

                {/* Bottom: Incidents */}
                <div className="flex-1 min-h-0">
                    <IncidentsPanel
                        dateFrom={appliedDateFrom}
                        dateTo={appliedDateTo}
                        workerFilter={appliedWorkerFilter}
                        alignedIncidentOid={alignedIncidentOid}
                        onAlign={handleAlign}
                        workerMap={workerMap}
                        catalogMap={catalogMap}
                        onFocusInteractions={handleFocusInteractions}
                    />
                </div>
            </div>}

            {/* Alignment Status Bar */}
            {!appliedRangeError && highlightWindow && (
                <div className="mx-4 mb-4">
                    <AlignmentStatusBar
                        incidentStableId={alignedIncidentStableId}
                        windowStart={highlightWindow.start}
                        windowEnd={highlightWindow.end}
                        onClear={handleClearAlignment}
                    />
                </div>
            )}
        </div>
    );
}

export function SSCDashboardPage(props: SSCDashboardPageProps) {
    const { ready } = useTimezone();
    const t = useTranslations('SSCDashboard');
    if (!ready) return <div role="status">{t('messages.loadingTimezone')}</div>;
    return <SSCDashboardContent {...props} />;
}
