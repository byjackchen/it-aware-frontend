import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { AnalysisClassificationResponse, SemanticSummary } from '@/lib/types/survey-analytics';

export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 15000;

interface AnalysisItem {
    oid: string;
    worker_oid: string;
    semantic: string | null;
    intent: string | null;
    service_catalog_oid: string | null;
    configuration_item_oid: string | null;
    topic: string;
    fact: string | null;
}

interface AnalysisPreviewData {
    oid: string;
    topic: string;
    semantic: string | null;
    intent: string | null;
    fact: string | null;
    worker_stable_id: string;
}

const MAX_PREVIEWS = 20;

function toPreview(a: AnalysisItem, workerStableMap: Map<string, string>): AnalysisPreviewData {
    return { oid: a.oid, topic: a.topic, semantic: a.semantic, intent: a.intent, fact: a.fact, worker_stable_id: workerStableMap.get(a.worker_oid) ?? '' };
}

interface WorkerItem {
    oid: string;
    location_oid: string | null;
    stable_id: string;
}

interface LocationItem {
    oid: string;
    name: string;
    type: string;
    parent_oid: string | null;
}

interface ServiceCatalogItem {
    oid: string;
    name: string;
    path: string[];
}

interface PaginatedResponse<T> {
    items: T[];
    total: number;
}

function buildCookieHeader(items: Array<{ name: string; value: string }>): string {
    return items
        .filter((item) => item.name.startsWith('it_aware_'))
        .filter((item) => {
            for (let i = 0; i < item.name.length; i++) {
                if (item.name.charCodeAt(i) > 127) return false;
            }
            for (let i = 0; i < item.value.length; i++) {
                if (item.value.charCodeAt(i) > 127) return false;
            }
            return true;
        })
        .map((item) => `${item.name}=${item.value}`)
        .join('; ');
}

async function fetchAll<T>(basePath: string, cookieHeader: string, params?: Record<string, string>): Promise<T[]> {
    const allItems: T[] = [];
    let skip = 0;
    const limit = 1000;

    while (true) {
        const url = new URL(`${RUNTIME_CONFIG.backend.domain}${basePath}`);
        url.searchParams.set('limit', String(limit));
        url.searchParams.set('skip', String(skip));
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                url.searchParams.set(k, v);
            }
        }

        const res = await fetch(url.toString(), {
            headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
            cache: 'no-store',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!res.ok) throw new Error(`Backend error: ${res.status}`);

        const data: PaginatedResponse<T> = await res.json();
        allItems.push(...data.items);

        if (allItems.length >= data.total || data.items.length < limit) break;
        skip += limit;
    }

    return allItems;
}

function addSemantic(summary: SemanticSummary, semantic: string | null) {
    if (semantic === 'positive') summary.positive++;
    else if (semantic === 'negative') summary.negative++;
    else summary.neutral++;
}

export async function GET(request: Request) {
    const cookieStore = await cookies();
    if (!cookieStore.get('it_aware_access')) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const cookieHeader = buildCookieHeader(cookieStore.getAll());

    const { searchParams } = new URL(request.url);
    const batchOid = searchParams.get('batch_oid');
    if (!batchOid) {
        return NextResponse.json({ error: 'batch_oid is required' }, { status: 400 });
    }

    try {
        const [analyses, serviceCatalogs, workers, locations] = await Promise.all([
            fetchAll<AnalysisItem>(
                '/objects/insights/analysiss',
                cookieHeader,
                { source_batch_oid: batchOid }
            ),
            fetchAll<ServiceCatalogItem>('/objects/service-catalogs', cookieHeader),
            fetchAll<WorkerItem>('/objects/workers', cookieHeader),
            fetchAll<LocationItem>('/objects/locations', cookieHeader),
        ]);

        // Build lookup maps
        const scMap = new Map<string, string>();
        for (const sc of serviceCatalogs) {
            scMap.set(sc.oid, sc.name);
        }

        const workerLocMap = new Map<string, string | null>();
        const workerStableMap = new Map<string, string>();
        for (const w of workers) {
            workerLocMap.set(w.oid, w.location_oid);
            workerStableMap.set(w.oid, w.stable_id);
        }

        const locMap = new Map<string, LocationItem>();
        for (const l of locations) {
            locMap.set(l.oid, l);
        }

        function getLocationName(workerOid: string): string | null {
            const locOid = workerLocMap.get(workerOid);
            if (!locOid) return null;
            return locMap.get(locOid)?.name ?? null;
        }

        // Overall semantic summary
        const semanticSummary: SemanticSummary = { positive: 0, negative: 0, neutral: 0 };

        // Intent summary
        const intentGroups = new Map<string, { count: number; analyses: AnalysisPreviewData[] }>();

        // By service catalog
        const scGroups = new Map<string, {
            oid: string; name: string; count: number;
            semantic: SemanticSummary;
            locationCounts: Map<string, number>;
            analyses: AnalysisPreviewData[];
        }>();

        // By configuration item
        const ciGroups = new Map<string, {
            oid: string; name: string; count: number;
            semantic: SemanticSummary;
            locationCounts: Map<string, number>;
            analyses: AnalysisPreviewData[];
        }>();

        // By location
        const locGroups = new Map<string, {
            location_oid: string; location_name: string; count: number;
            semantic: SemanticSummary;
            issueCounts: Map<string, { count: number; type: string }>;
        }>();

        for (const a of analyses) {
            addSemantic(semanticSummary, a.semantic);

            // Intent
            if (a.intent) {
                let ig = intentGroups.get(a.intent);
                if (!ig) {
                    ig = { count: 0, analyses: [] };
                    intentGroups.set(a.intent, ig);
                }
                ig.count++;
                if (ig.analyses.length < MAX_PREVIEWS) ig.analyses.push(toPreview(a, workerStableMap));
            }

            const locName = getLocationName(a.worker_oid);

            // Service catalog grouping
            if (a.service_catalog_oid) {
                const name = scMap.get(a.service_catalog_oid) ?? a.service_catalog_oid;
                let group = scGroups.get(a.service_catalog_oid);
                if (!group) {
                    group = { oid: a.service_catalog_oid, name, count: 0, semantic: { positive: 0, negative: 0, neutral: 0 }, locationCounts: new Map(), analyses: [] };
                    scGroups.set(a.service_catalog_oid, group);
                }
                group.count++;
                addSemantic(group.semantic, a.semantic);
                if (group.analyses.length < MAX_PREVIEWS) group.analyses.push(toPreview(a, workerStableMap));
                if (locName) group.locationCounts.set(locName, (group.locationCounts.get(locName) ?? 0) + 1);
            }

            // Configuration item grouping
            if (a.configuration_item_oid) {
                const name = scMap.get(a.configuration_item_oid) ?? a.configuration_item_oid;
                let group = ciGroups.get(a.configuration_item_oid);
                if (!group) {
                    group = { oid: a.configuration_item_oid, name, count: 0, semantic: { positive: 0, negative: 0, neutral: 0 }, locationCounts: new Map(), analyses: [] };
                    ciGroups.set(a.configuration_item_oid, group);
                }
                group.count++;
                addSemantic(group.semantic, a.semantic);
                if (group.analyses.length < MAX_PREVIEWS) group.analyses.push(toPreview(a, workerStableMap));
                if (locName) group.locationCounts.set(locName, (group.locationCounts.get(locName) ?? 0) + 1);
            }

            // Location grouping
            if (locName) {
                const locOid = workerLocMap.get(a.worker_oid) ?? '';
                let locGroup = locGroups.get(locOid);
                if (!locGroup) {
                    locGroup = { location_oid: locOid, location_name: locName, count: 0, semantic: { positive: 0, negative: 0, neutral: 0 }, issueCounts: new Map() };
                    locGroups.set(locOid, locGroup);
                }
                locGroup.count++;
                addSemantic(locGroup.semantic, a.semantic);

                // Track issues per location
                if (a.service_catalog_oid) {
                    const issueName = scMap.get(a.service_catalog_oid) ?? a.service_catalog_oid;
                    const existing = locGroup.issueCounts.get(issueName);
                    if (existing) existing.count++;
                    else locGroup.issueCounts.set(issueName, { count: 1, type: 'service_catalog' });
                }
                if (a.configuration_item_oid) {
                    const issueName = scMap.get(a.configuration_item_oid) ?? a.configuration_item_oid;
                    const existing = locGroup.issueCounts.get(issueName);
                    if (existing) existing.count++;
                    else locGroup.issueCounts.set(issueName, { count: 1, type: 'configuration_item' });
                }
            }
        }

        function topLocations(lc: Map<string, number>, total: number) {
            return Array.from(lc.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => ({
                    location_name: name,
                    count,
                    percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
                }));
        }

        const totalAnalyses = analyses.length;

        const intentSummary = Array.from(intentGroups.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .map(([intent, g]) => ({
                intent,
                count: g.count,
                percentage: totalAnalyses > 0 ? Math.round((g.count / totalAnalyses) * 1000) / 10 : 0,
                analyses: g.analyses,
            }));

        const byServiceCatalog = Array.from(scGroups.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 15)
            .map((g) => ({
                oid: g.oid,
                name: g.name,
                count: g.count,
                semantic: g.semantic,
                top_locations: topLocations(g.locationCounts, g.count),
                analyses: g.analyses,
            }));

        const byConfigItem = Array.from(ciGroups.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 15)
            .map((g) => ({
                oid: g.oid,
                name: g.name,
                count: g.count,
                semantic: g.semantic,
                top_locations: topLocations(g.locationCounts, g.count),
                analyses: g.analyses,
            }));

        const byLocation = Array.from(locGroups.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 20)
            .map((g) => ({
                location_oid: g.location_oid,
                location_name: g.location_name,
                count: g.count,
                semantic: g.semantic,
                top_issues: Array.from(g.issueCounts.entries())
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 5)
                    .map(([name, val]) => ({ name, count: val.count, type: val.type })),
            }));

        const payload: AnalysisClassificationResponse = {
            generated_at: new Date().toISOString(),
            total_analyses: totalAnalyses,
            semantic_summary: semanticSummary,
            intent_summary: intentSummary,
            by_service_catalog: byServiceCatalog,
            by_configuration_item: byConfigItem,
            by_location: byLocation,
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('[survey-analytics/analysis-classification]', error);
        return NextResponse.json({ error: 'Failed to aggregate analysis data' }, { status: 500 });
    }
}
