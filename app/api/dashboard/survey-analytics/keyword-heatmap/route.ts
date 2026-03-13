import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { KeywordHeatmapResponse, KeywordItem, GroupedKeywordHeatmapResponse } from '@/lib/types/survey-analytics';

export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 15000;

interface AnalysisItem {
    oid: string;
    worker_oid: string;
    keywords: string[] | null;
    semantic: string | null;
    topic: string;
    intent: string | null;
    fact: string | null;
    source_oid: string | null;
    service_catalog_oid: string | null;
}

interface WorkerItem {
    oid: string;
    stable_id: string;
    location_oid: string | null;
}

interface ServiceCatalogItem {
    oid: string;
    name: string;
    path: string[];
}

interface LocationItem {
    oid: string;
    name: string;
    path: string[];
}

const MAX_PREVIEWS = 20;

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

interface AnalysisPreviewData {
    oid: string;
    topic: string;
    semantic: string | null;
    intent: string | null;
    fact: string | null;
    worker_stable_id: string;
    source_oid: string | null;
}

interface KeywordEntry {
    display: string;
    total: number;
    positive: number;
    negative: number;
    neutral: number;
    oids: string[];
    analyses: AnalysisPreviewData[];
}

function toKeywordItem(entry: KeywordEntry): KeywordItem {
    let dominant: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (entry.positive > entry.negative && entry.positive > entry.neutral) dominant = 'positive';
    else if (entry.negative > entry.positive && entry.negative > entry.neutral) dominant = 'negative';

    return {
        keyword: entry.display,
        total_count: entry.total,
        positive_count: entry.positive,
        negative_count: entry.negative,
        neutral_count: entry.neutral,
        dominant_sentiment: dominant,
        analysis_oids: entry.oids,
        analyses: entry.analyses,
    };
}

function addToKeywordMap(
    map: Map<string, KeywordEntry>,
    kw: string,
    a: AnalysisItem,
    workerStableMap: Map<string, string>,
) {
    const normalized = kw.toLowerCase().trim();
    if (!normalized) return;

    let entry = map.get(normalized);
    if (!entry) {
        entry = { display: kw.trim(), total: 0, positive: 0, negative: 0, neutral: 0, oids: [], analyses: [] };
        map.set(normalized, entry);
    }
    entry.total++;
    if (a.semantic === 'positive') entry.positive++;
    else if (a.semantic === 'negative') entry.negative++;
    else entry.neutral++;
    if (entry.oids.length < 5) entry.oids.push(a.oid);
    if (entry.analyses.length < MAX_PREVIEWS) {
        entry.analyses.push({
            oid: a.oid,
            topic: a.topic,
            semantic: a.semantic,
            intent: a.intent,
            fact: a.fact,
            worker_stable_id: workerStableMap.get(a.worker_oid) ?? '',
            source_oid: a.source_oid,
        });
    }
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

    function parseLevelParam(name: string): number | null {
        const raw = searchParams.get(name);
        if (!raw) return null;
        const n = parseInt(raw, 10);
        if (isNaN(n) || n < 1 || n > 3) return -1; // sentinel for invalid
        return n;
    }

    const scLevel = parseLevelParam('sc_level');
    const locLevel = parseLevelParam('loc_level');
    if (scLevel === -1) return NextResponse.json({ error: 'sc_level must be 1, 2, or 3' }, { status: 400 });
    if (locLevel === -1) return NextResponse.json({ error: 'loc_level must be 1, 2, or 3' }, { status: 400 });

    const hasGrouping = scLevel !== null || locLevel !== null;

    try {
        const [analyses, workers, serviceCatalogs, locations] = await Promise.all([
            fetchAll<AnalysisItem>('/objects/insights/analysiss', cookieHeader, { source_batch_oid: batchOid }),
            fetchAll<WorkerItem>('/objects/workers', cookieHeader),
            scLevel !== null ? fetchAll<ServiceCatalogItem>('/objects/service-catalogs', cookieHeader) : Promise.resolve([] as ServiceCatalogItem[]),
            locLevel !== null ? fetchAll<LocationItem>('/objects/locations', cookieHeader) : Promise.resolve([] as LocationItem[]),
        ]);

        const workerStableMap = new Map<string, string>();
        for (const w of workers) {
            workerStableMap.set(w.oid, w.stable_id);
        }

        // Flat response (no grouping)
        if (!hasGrouping) {
            const keywordMap = new Map<string, KeywordEntry>();
            for (const a of analyses) {
                if (!a.keywords) continue;
                for (const kw of a.keywords) {
                    addToKeywordMap(keywordMap, kw, a, workerStableMap);
                }
            }

            const keywords = Array.from(keywordMap.values())
                .sort((a, b) => b.total - a.total)
                .map(toKeywordItem);

            const payload: KeywordHeatmapResponse = {
                generated_at: new Date().toISOString(),
                keywords,
            };
            return NextResponse.json(payload);
        }

        // Build lookup maps as needed
        const scMap = new Map<string, ServiceCatalogItem>();
        for (const sc of serviceCatalogs) scMap.set(sc.oid, sc);

        const locationMap = new Map<string, LocationItem>();
        for (const loc of locations) locationMap.set(loc.oid, loc);

        const workerLocationMap = new Map<string, string | null>();
        if (locLevel !== null) {
            for (const w of workers) workerLocationMap.set(w.oid, w.location_oid);
        }

        // Resolve ancestor OID + name for a hierarchy item
        function resolveAncestor(
            itemOid: string | null,
            lookupMap: Map<string, { oid: string; name: string; path: string[] }>,
            level: number,
        ): { oid: string; name: string } | null {
            if (!itemOid) return null;
            const item = lookupMap.get(itemOid);
            if (!item) return null;
            const ancestorOid = item.path[Math.min(level - 1, item.path.length - 1)];
            const ancestor = lookupMap.get(ancestorOid);
            return { oid: ancestorOid, name: ancestor?.name ?? ancestorOid };
        }

        const ungroupedKeywordMap = new Map<string, KeywordEntry>();

        // Helper: build flat groups from a keyword-maps collection
        function buildFlatGroups(
            groupKwMaps: Map<string, Map<string, KeywordEntry>>,
            nameMap: Map<string, string>,
            maxGroups: number,
        ) {
            return Array.from(groupKwMaps.entries())
                .map(([key, kwMap]) => {
                    const keywords = Array.from(kwMap.values())
                        .sort((a, b) => b.total - a.total)
                        .slice(0, 50)
                        .map(toKeywordItem);
                    const totalCount = Array.from(kwMap.values()).reduce((sum, e) => sum + e.total, 0);
                    return { group_oid: key, group_name: nameMap.get(key) ?? key, total_count: totalCount, keywords };
                })
                .sort((a, b) => b.total_count - a.total_count)
                .slice(0, maxGroups);
        }

        let groups: Array<{
            group_oid: string;
            group_name: string;
            total_count: number;
            keywords: KeywordItem[];
            sub_groups?: Array<{ group_oid: string; group_name: string; total_count: number; keywords: KeywordItem[] }>;
        }>;

        if (scLevel !== null && locLevel !== null) {
            // Nested: Location (outer) → Service Catalog (inner) → Keywords
            // locOid → scOid → keyword map
            const nestedMaps = new Map<string, Map<string, Map<string, KeywordEntry>>>();
            const locNames = new Map<string, string>();
            const scNames = new Map<string, string>();

            for (const a of analyses) {
                if (!a.keywords || a.keywords.length === 0) continue;

                const locOid = workerLocationMap.get(a.worker_oid) ?? null;
                const locAncestor = resolveAncestor(locOid, locationMap, locLevel);
                const scAncestor = resolveAncestor(a.service_catalog_oid, scMap, scLevel);

                if (!locAncestor) {
                    for (const kw of a.keywords) addToKeywordMap(ungroupedKeywordMap, kw, a, workerStableMap);
                    continue;
                }

                if (!locNames.has(locAncestor.oid)) locNames.set(locAncestor.oid, locAncestor.name);

                // If no SC ancestor, put keywords directly on the location (no sub-group key → use special key)
                const scKey = scAncestor?.oid ?? '__no_sc__';
                if (scAncestor && !scNames.has(scAncestor.oid)) scNames.set(scAncestor.oid, scAncestor.name);

                let locMap = nestedMaps.get(locAncestor.oid);
                if (!locMap) {
                    locMap = new Map();
                    nestedMaps.set(locAncestor.oid, locMap);
                }

                let kwMap = locMap.get(scKey);
                if (!kwMap) {
                    kwMap = new Map<string, KeywordEntry>();
                    locMap.set(scKey, kwMap);
                }
                for (const kw of a.keywords) addToKeywordMap(kwMap, kw, a, workerStableMap);
            }

            // Build nested groups
            groups = Array.from(nestedMaps.entries())
                .map(([locOid, scMaps]) => {
                    const subGroups = buildFlatGroups(scMaps, scNames, 12);
                    const totalCount = subGroups.reduce((sum, sg) => sum + sg.total_count, 0);
                    return {
                        group_oid: locOid,
                        group_name: locNames.get(locOid) ?? locOid,
                        total_count: totalCount,
                        keywords: [] as KeywordItem[],
                        sub_groups: subGroups,
                    };
                })
                .sort((a, b) => b.total_count - a.total_count)
                .slice(0, 12);
        } else {
            // Single-dimension grouping
            const groupKeywordMaps = new Map<string, Map<string, KeywordEntry>>();
            const groupNames = new Map<string, string>();

            for (const a of analyses) {
                if (!a.keywords || a.keywords.length === 0) continue;

                let ancestor: { oid: string; name: string } | null = null;
                if (scLevel !== null) {
                    ancestor = resolveAncestor(a.service_catalog_oid, scMap, scLevel);
                } else if (locLevel !== null) {
                    const locOid = workerLocationMap.get(a.worker_oid) ?? null;
                    ancestor = resolveAncestor(locOid, locationMap, locLevel);
                }

                if (!ancestor) {
                    for (const kw of a.keywords) addToKeywordMap(ungroupedKeywordMap, kw, a, workerStableMap);
                    continue;
                }

                if (!groupNames.has(ancestor.oid)) groupNames.set(ancestor.oid, ancestor.name);

                let kwMap = groupKeywordMaps.get(ancestor.oid);
                if (!kwMap) {
                    kwMap = new Map<string, KeywordEntry>();
                    groupKeywordMaps.set(ancestor.oid, kwMap);
                }
                for (const kw of a.keywords) addToKeywordMap(kwMap, kw, a, workerStableMap);
            }

            groups = buildFlatGroups(groupKeywordMaps, groupNames, 20);
        }

        const ungroupedKeywords = Array.from(ungroupedKeywordMap.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, 50)
            .map(toKeywordItem);

        const payload: GroupedKeywordHeatmapResponse = {
            generated_at: new Date().toISOString(),
            sc_level: scLevel,
            loc_level: locLevel,
            groups,
            ungrouped_keywords: ungroupedKeywords,
        };
        return NextResponse.json(payload);
    } catch (error) {
        console.error('[survey-analytics/keyword-heatmap]', error);
        return NextResponse.json({ error: 'Failed to aggregate keyword data' }, { status: 500 });
    }
}
