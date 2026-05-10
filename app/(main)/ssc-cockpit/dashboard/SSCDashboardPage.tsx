'use client';

import { useState, useCallback, useEffect } from 'react';
import { LayoutDashboard } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { SSCFilterBar } from '@/components/ssc/SSCFilterBar';
import { InteractionsPanel } from '@/components/ssc/InteractionsPanel';
import { IncidentsPanel } from '@/components/ssc/IncidentsPanel';
import { AlignmentStatusBar } from '@/components/ssc/AlignmentStatusBar';
import type { WorkerContext, Incident, Interaction } from '@/lib/types/objects';

interface SSCDashboardPageProps {
    initialWorkerMap: Record<string, WorkerContext>;
    initialCatalogMap: Record<string, string>;
}

const ALIGN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function getDefaultDateFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
}

function getDefaultDateTo(): string {
    return new Date().toISOString().slice(0, 10);
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

export function SSCDashboardPage({ initialWorkerMap, initialCatalogMap }: SSCDashboardPageProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // Lookup maps from server-side props
    const workerMap = initialWorkerMap;
    const catalogMap = initialCatalogMap;

    // Filter state
    const [dateFrom, setDateFrom] = useState(getDefaultDateFrom);
    const [dateTo, setDateTo] = useState(getDefaultDateTo);
    const [appliedDateFrom, setAppliedDateFrom] = useState(getDefaultDateFrom);
    const [appliedDateTo, setAppliedDateTo] = useState(getDefaultDateTo);
    const [workerFilter, setWorkerFilter] = useState('');
    const [appliedWorkerFilter, setAppliedWorkerFilter] = useState('');

    // Alignment state
    const [alignedIncidentOid, setAlignedIncidentOid] = useState<string | null>(null);
    const [alignedIncidentStableId, setAlignedIncidentStableId] = useState<string>('');
    const [alignedWorkerStableId, setAlignedWorkerStableId] = useState<string | null>(null);
    const [highlightWindow, setHighlightWindow] = useState<{ start: number; end: number } | null>(null);
    const [alignedRowOid, setAlignedRowOid] = useState<string | null>(null);

    // Interactions panel date range — overridden during alignment
    const [interactionDateFrom, setInteractionDateFrom] = useState(getDefaultDateFrom);
    const [interactionDateTo, setInteractionDateTo] = useState(getDefaultDateTo);

    // Track interactions loaded by InteractionsPanel for alignment search
    const [interactionsRef, setInteractionsRef] = useState<Interaction[]>([]);

    // Focused interaction OIDs — driven by the Pre-FAQ button in IncidentsPanel
    const [focusedInteractionOids, setFocusedInteractionOids] = useState<Set<string> | null>(null);

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
    }, [dateFrom, dateTo, workerFilter]);

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

        // Narrow interactions panel to the 30-min window so it fetches the right data
        const windowStartDate = new Date(windowStart).toISOString().slice(0, 10);
        const windowEndDate = new Date(incidentTs + 86400000).toISOString().slice(0, 10);
        setInteractionDateFrom(windowStartDate);
        setInteractionDateTo(windowEndDate);

        setAlignedIncidentOid(incident.oid);
        setAlignedIncidentStableId(incident.stable_id ?? incident.oid);
        setAlignedWorkerStableId(incidentWorkerStableId);
        setHighlightWindow({ start: windowStart, end: incidentTs });
        setAlignedRowOid(null);
    }, [alignedIncidentOid, appliedDateFrom, appliedDateTo, workerMap]);

    const handleClearAlignment = useCallback(() => {
        setAlignedIncidentOid(null);
        setAlignedWorkerStableId(null);
        setHighlightWindow(null);
        setAlignedRowOid(null);
        setInteractionDateFrom(appliedDateFrom);
        setInteractionDateTo(appliedDateTo);
    }, [appliedDateFrom, appliedDateTo]);

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
                    onDateFromChange={setDateFrom}
                    onDateToChange={setDateTo}
                    onWorkerFilterChange={setWorkerFilter}
                    onApply={handleApplyFilters}
                />
            </div>

            {/* Split Panels */}
            <div className={`flex-1 flex mx-4 mb-0 rounded-t-xl overflow-hidden border ${
                isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'
            }`}>
                {/* Left: Interactions (flex 3) */}
                <div className={`flex-[3] border-r ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
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

                {/* Right: Incidents (flex 2) */}
                <div className="flex-[2]">
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
            </div>

            {/* Alignment Status Bar */}
            {highlightWindow && (
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
