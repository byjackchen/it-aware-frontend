'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    Analysis,
    AnalysisListResponse,
    Incident,
    IncidentListResponse,
    Interaction,
    InteractionListResponse,
    Request,
    RequestListResponse,
    Survey,
    Worker,
} from '@/lib/types/objects';
import type { PersonaActivityEvent, TimelineWindowState } from './types';

const PER_ENDPOINT_LIMIT = 1000;
const MAX_TIMELINE_EVENTS = 1000;

interface UsePersonaActivitiesResult {
    events: PersonaActivityEvent[];
    windowEvents: PersonaActivityEvent[];
    isInitialLoading: boolean;
    isBackgroundLoading: boolean;
    error: string | null;
    totalEvents: number;
    isTruncated: boolean;
    reload: () => void;
}

interface TimeRange {
    startMs: number;
    endMs: number;
}

interface ActivitiesCache {
    loadedRanges: TimeRange[];
    pendingRanges: Map<string, TimeRange>;
    eventsById: Map<string, PersonaActivityEvent>;
}

interface WindowEventsComputation {
    windowEvents: PersonaActivityEvent[];
    boundedEvents: PersonaActivityEvent[];
    total: number;
}

function parseTimestamp(value: string): number {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeRange(range: TimeRange): TimeRange | null {
    if (!Number.isFinite(range.startMs) || !Number.isFinite(range.endMs)) {
        return null;
    }

    const startMs = Math.min(range.startMs, range.endMs);
    const endMs = Math.max(range.startMs, range.endMs);
    return { startMs, endMs };
}

function rangeKey(range: TimeRange): string {
    return `${range.startMs}-${range.endMs}`;
}

function createCache(): ActivitiesCache {
    return {
        loadedRanges: [],
        pendingRanges: new Map<string, TimeRange>(),
        eventsById: new Map<string, PersonaActivityEvent>(),
    };
}

function mergeRanges(ranges: TimeRange[]): TimeRange[] {
    if (ranges.length <= 1) return ranges.slice();

    const sorted = [...ranges]
        .map((range) => normalizeRange(range))
        .filter((range): range is TimeRange => range !== null)
        .sort((a, b) => a.startMs - b.startMs);

    if (sorted.length <= 1) return sorted;

    const merged: TimeRange[] = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];

        if (current.startMs <= (last.endMs + 1)) {
            last.endMs = Math.max(last.endMs, current.endMs);
            continue;
        }

        merged.push({ ...current });
    }

    return merged;
}

function subtractCoveredRanges(requestRange: TimeRange, coveredRanges: TimeRange[]): TimeRange[] {
    const request = normalizeRange(requestRange);
    if (!request) return [];

    const covered = mergeRanges(coveredRanges);
    const missing: TimeRange[] = [];
    let cursor = request.startMs;

    for (const range of covered) {
        if (range.endMs < cursor) continue;
        if (range.startMs > request.endMs) break;

        if (range.startMs > cursor) {
            missing.push({
                startMs: cursor,
                endMs: Math.min(range.startMs - 1, request.endMs),
            });
        }

        cursor = Math.max(cursor, range.endMs + 1);
        if (cursor > request.endMs) {
            break;
        }
    }

    if (cursor <= request.endMs) {
        missing.push({
            startMs: cursor,
            endMs: request.endMs,
        });
    }

    return missing;
}

function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
    return a.startMs <= b.endMs && b.startMs <= a.endMs;
}

function buildUrl(resource: string, query: Record<string, string | number | undefined>): string {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined) return;
        const normalized = String(value).trim();
        if (normalized.length === 0) return;
        params.set(key, normalized);
    });

    return `/api/objects/${resource}?${params.toString()}`;
}

async function fetchListEnvelope<T>(url: string): Promise<T[]> {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url} (${response.status})`);
    }

    const payload = await response.json() as { items?: unknown };
    if (!Array.isArray(payload.items)) {
        throw new Error(`Unexpected response shape from ${url}`);
    }

    return payload.items as T[];
}

function toIncidentEvent(item: Incident): PersonaActivityEvent {
    return {
        id: `incident-${item.oid}`,
        oid: item.oid,
        type: 'incident',
        title: item.title || item.stable_id || item.oid,
        subtitle: [item.state, item.priority].filter(Boolean).join(' · '),
        createdAt: item.created_at,
        href: `/data/incidents/${item.oid}`,
        raw: item,
    };
}

function toRequestEvent(item: Request): PersonaActivityEvent {
    return {
        id: `request-${item.oid}`,
        oid: item.oid,
        type: 'request',
        title: item.title || item.stable_id || item.oid,
        subtitle: [item.state, item.priority].filter(Boolean).join(' · '),
        createdAt: item.created_at,
        href: `/data/requests/${item.oid}`,
        raw: item,
    };
}

function toInteractionEvent(item: Interaction): PersonaActivityEvent {
    return {
        id: `interaction-${item.oid}`,
        oid: item.oid,
        type: 'interaction',
        title: item.content_text || item.response_text || item.action_type,
        subtitle: [item.source_system, item.action_type].filter(Boolean).join(' · '),
        createdAt: item.created_at,
        href: `/data/interactions/${item.oid}`,
        raw: item,
    };
}

interface CrossBatchSurveyItem {
    survey_oid: string;
    survey_batch_oid: string;
    survey_batch_name?: string;
    survey_batch_status?: string;
    receiver_stable_id: string;
    receiver_oid: string;
    survey_status: string;
    survey_questions: Survey['survey_questions'];
    survey_answer: Survey['survey_answer'];
    submitted_at: string | null;
    created_at: string;
    updated_at: string;
}

function toSurveyEvent(item: CrossBatchSurveyItem): PersonaActivityEvent {
    return {
        id: `survey-${item.survey_oid}`,
        oid: item.survey_oid,
        type: 'survey',
        title: item.survey_batch_name || item.survey_status || item.survey_oid,
        subtitle: item.survey_status + (item.submitted_at ? ` · ${new Date(item.submitted_at).toLocaleDateString()}` : ''),
        createdAt: item.submitted_at ?? item.created_at,
        href: `/data/surveys/${item.survey_oid}`,
        raw: item as unknown as Survey,
    };
}

function toAnalysisEvent(item: Analysis): PersonaActivityEvent {
    return {
        id: `analysis-${item.oid}`,
        oid: item.oid,
        type: 'analysis',
        title: item.topic || item.oid,
        subtitle: [item.semantic, item.intent].filter(Boolean).join(' · '),
        createdAt: item.effective_at ?? item.created_at,
        href: `/data/analyses/${item.oid}`,
        raw: item,
    };
}

function buildEventsForWindow(cache: ActivitiesCache, range: TimeRange): WindowEventsComputation {
    const windowEvents = Array.from(cache.eventsById.values())
        .filter((event) => {
            const timestamp = parseTimestamp(event.createdAt);
            return timestamp >= range.startMs && timestamp <= range.endMs;
        })
        .sort((a, b) => {
            const timeDelta = parseTimestamp(a.createdAt) - parseTimestamp(b.createdAt);
            if (timeDelta !== 0) return timeDelta;
            return a.id.localeCompare(b.id);
        });

    const boundedEvents = windowEvents.length > MAX_TIMELINE_EVENTS
        ? windowEvents.slice(-MAX_TIMELINE_EVENTS)
        : windowEvents;

    return {
        windowEvents,
        boundedEvents,
        total: windowEvents.length,
    };
}

function buildCampaignUrl(resource: string, query: Record<string, string | number | undefined>): string {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value === undefined) return;
        const normalized = String(value).trim();
        if (normalized.length === 0) return;
        params.set(key, normalized);
    });

    return `/api/campaigns/${resource}?${params.toString()}`;
}

async function fetchActivitiesForRange(
    worker: Worker,
    range: TimeRange,
    includeInteractions: boolean
): Promise<PersonaActivityEvent[]> {
    const createdAtFrom = new Date(range.startMs).toISOString();
    const createdAtTo = new Date(range.endMs).toISOString();

    const incidentsUrl = buildUrl('incidents', {
        actor_oid: worker.oid,
        created_at_from: createdAtFrom,
        created_at_to: createdAtTo,
        skip: 0,
        limit: PER_ENDPOINT_LIMIT,
    });
    const requestsUrl = buildUrl('requests', {
        actor_oid: worker.oid,
        created_at_from: createdAtFrom,
        created_at_to: createdAtTo,
        skip: 0,
        limit: PER_ENDPOINT_LIMIT,
    });
    const surveysUrl = buildCampaignUrl('surveys', {
        receiver_stable_id: worker.stable_id,
        skip: 0,
        limit: PER_ENDPOINT_LIMIT,
    });
    const analysesUrl = buildUrl('analysiss', {
        worker_oid: worker.oid,
        effective_at_from: createdAtFrom,
        effective_at_to: createdAtTo,
        skip: 0,
        limit: PER_ENDPOINT_LIMIT,
    });

    const [incidents, requests, interactions, surveys, analyses] = await Promise.all([
        fetchListEnvelope<Incident>(incidentsUrl),
        fetchListEnvelope<Request>(requestsUrl),
        includeInteractions
            ? fetchListEnvelope<Interaction>(
                buildUrl('interactions', {
                    actor_stable_id: worker.stable_id,
                    created_at_from: createdAtFrom,
                    created_at_to: createdAtTo,
                    sort_by: 'created_at',
                    order: 'desc',
                    skip: 0,
                    limit: PER_ENDPOINT_LIMIT,
                })
            )
            : Promise.resolve<InteractionListResponse['items']>([]),
        fetchListEnvelope<CrossBatchSurveyItem>(surveysUrl),
        fetchListEnvelope<Analysis>(analysesUrl),
    ]) as [IncidentListResponse['items'], RequestListResponse['items'], InteractionListResponse['items'], CrossBatchSurveyItem[], AnalysisListResponse['items']];

    return [
        ...incidents.map(toIncidentEvent),
        ...requests.map(toRequestEvent),
        ...interactions.map(toInteractionEvent),
        ...surveys.map(toSurveyEvent),
        ...analyses.map(toAnalysisEvent),
    ];
}

export function usePersonaActivities(
    worker: Worker,
    window: TimelineWindowState,
    includeInteractions: boolean = false
): UsePersonaActivitiesResult {
    const [events, setEvents] = useState<PersonaActivityEvent[]>([]);
    const [windowEvents, setWindowEvents] = useState<PersonaActivityEvent[]>([]);
    const [totalEvents, setTotalEvents] = useState(0);
    const [isInitialLoading, setIsInitialLoading] = useState(false);
    const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const cacheRef = useRef<ActivitiesCache>(createCache());
    const cacheKeyRef = useRef('');
    const requestSequenceRef = useRef(0);

    const requestRange = useMemo<TimeRange>(() => ({
        startMs: window.start.getTime(),
        endMs: window.end.getTime(),
    }), [window.end, window.start]);

    const cacheKey = useMemo(() => ([
        worker.oid,
        worker.stable_id,
        includeInteractions ? 'with-interactions' : 'without-interactions',
        String(reloadToken),
    ].join('::')), [includeInteractions, reloadToken, worker.oid, worker.stable_id]);

    const reload = useCallback(() => {
        setReloadToken((value) => value + 1);
    }, []);

    useEffect(() => {
        if (cacheKeyRef.current !== cacheKey) {
            cacheKeyRef.current = cacheKey;
            cacheRef.current = createCache();
        }

        const cache = cacheRef.current;
        const normalizedRange = normalizeRange(requestRange);
        if (!normalizedRange) {
            setEvents([]);
            setWindowEvents([]);
            setTotalEvents(0);
            setIsInitialLoading(false);
            setIsBackgroundLoading(false);
            setError(null);
            return;
        }

        const activeRange: TimeRange = normalizedRange;
        const requestId = requestSequenceRef.current + 1;
        requestSequenceRef.current = requestId;
        let isCancelled = false;

        const isActiveRequest = () => !isCancelled && requestSequenceRef.current === requestId;

        const publishCurrentWindow = () => {
            const currentCache = cacheRef.current;
            const computed = buildEventsForWindow(currentCache, activeRange);
            if (!isActiveRequest()) return computed;
            setWindowEvents(computed.windowEvents);
            setEvents(computed.boundedEvents);
            setTotalEvents(computed.total);
            return computed;
        };

        async function loadMissingRanges() {
            const coveredRanges = mergeRanges([
                ...cache.loadedRanges,
                ...Array.from(cache.pendingRanges.values()),
            ]);
            const missingRanges = subtractCoveredRanges(activeRange, coveredRanges);
            const missingKeys = missingRanges.map(rangeKey);
            const hasCoveredSegment = coveredRanges.some((range) => rangesOverlap(range, activeRange));
            const hasPendingInWindow = Array.from(cache.pendingRanges.values())
                .some((range) => rangesOverlap(range, activeRange));

            const currentComputed = publishCurrentWindow();
            const hasCurrentData = (currentComputed?.windowEvents.length ?? 0) > 0;

            if (missingRanges.length === 0) {
                if (isActiveRequest()) {
                    setError(null);
                    setIsInitialLoading(false);
                    setIsBackgroundLoading(hasPendingInWindow);
                }
                return;
            }

            missingRanges.forEach((range) => {
                cache.pendingRanges.set(rangeKey(range), range);
            });

            if (isActiveRequest()) {
                setError(null);
                const shouldUseInitialLoading = !hasCurrentData && !hasCoveredSegment;
                setIsInitialLoading(shouldUseInitialLoading);
                setIsBackgroundLoading(!shouldUseInitialLoading);
            }

            try {
                const results = await Promise.all(
                    missingRanges.map((range) => fetchActivitiesForRange(worker, range, includeInteractions))
                );

                results.flat().forEach((event) => {
                    cache.eventsById.set(event.id, event);
                });

                cache.loadedRanges = mergeRanges([...cache.loadedRanges, ...missingRanges]);
            } catch (loadError) {
                const message = loadError instanceof Error
                    ? loadError.message
                    : 'Failed to load activities timeline';
                if (isActiveRequest()) {
                    setError(message);
                }
            } finally {
                missingKeys.forEach((key) => {
                    cache.pendingRanges.delete(key);
                });

                if (isActiveRequest()) {
                    const hasPending = Array.from(cache.pendingRanges.values())
                        .some((range) => rangesOverlap(range, activeRange));
                    setIsInitialLoading(false);
                    setIsBackgroundLoading(hasPending);
                    publishCurrentWindow();
                }
            }
        }

        void loadMissingRanges();

        return () => {
            isCancelled = true;
        };
    }, [cacheKey, includeInteractions, requestRange, worker]);

    return {
        events,
        windowEvents,
        isInitialLoading,
        isBackgroundLoading,
        error,
        totalEvents,
        isTruncated: totalEvents > events.length,
        reload,
    };
}
