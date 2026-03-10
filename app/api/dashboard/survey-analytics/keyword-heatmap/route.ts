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
}

interface ServiceCatalogItem {
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

    const groupLevelParam = searchParams.get('group_level');
    const groupLevel = groupLevelParam ? parseInt(groupLevelParam, 10) : null;
    if (groupLevel !== null && (isNaN(groupLevel) || groupLevel < 1 || groupLevel > 3)) {
        return NextResponse.json({ error: 'group_level must be 1, 2, or 3' }, { status: 400 });
    }

    try {
        const fetchPromises: [Promise<AnalysisItem[]>, Promise<WorkerItem[]>, Promise<ServiceCatalogItem[]> | null] = [
            fetchAll<AnalysisItem>('/objects/insights/analysiss', cookieHeader, { source_batch_oid: batchOid }),
            fetchAll<WorkerItem>('/objects/workers', cookieHeader),
            groupLevel !== null ? fetchAll<ServiceCatalogItem>('/objects/service-catalogs', cookieHeader) : null,
        ];

        const [analyses, workers, serviceCatalogs] = await Promise.all([
            fetchPromises[0],
            fetchPromises[1],
            fetchPromises[2] ?? Promise.resolve([] as ServiceCatalogItem[]),
        ]);

        const workerStableMap = new Map<string, string>();
        for (const w of workers) {
            workerStableMap.set(w.oid, w.stable_id);
        }

        // Flat response (no grouping)
        if (groupLevel === null) {
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

        // Grouped response
        const scMap = new Map<string, ServiceCatalogItem>();
        for (const sc of serviceCatalogs) {
            scMap.set(sc.oid, sc);
        }

        // Map: ancestor OID -> keyword map
        const groupKeywordMaps = new Map<string, Map<string, KeywordEntry>>();
        const ungroupedKeywordMap = new Map<string, KeywordEntry>();

        // Track ancestor OID -> resolved name
        const ancestorNames = new Map<string, string>();

        for (const a of analyses) {
            if (!a.keywords || a.keywords.length === 0) continue;

            if (!a.service_catalog_oid) {
                // Ungrouped
                for (const kw of a.keywords) {
                    addToKeywordMap(ungroupedKeywordMap, kw, a, workerStableMap);
                }
                continue;
            }

            const sc = scMap.get(a.service_catalog_oid);
            if (!sc) {
                // SC not found — treat as ungrouped
                for (const kw of a.keywords) {
                    addToKeywordMap(ungroupedKeywordMap, kw, a, workerStableMap);
                }
                continue;
            }

            // Resolve ancestor at requested level
            const ancestorOid = sc.path[Math.min(groupLevel - 1, sc.path.length - 1)];
            if (!ancestorNames.has(ancestorOid)) {
                const ancestorSc = scMap.get(ancestorOid);
                ancestorNames.set(ancestorOid, ancestorSc?.name ?? ancestorOid);
            }

            let kwMap = groupKeywordMaps.get(ancestorOid);
            if (!kwMap) {
                kwMap = new Map<string, KeywordEntry>();
                groupKeywordMaps.set(ancestorOid, kwMap);
            }
            for (const kw of a.keywords) {
                addToKeywordMap(kwMap, kw, a, workerStableMap);
            }
        }

        // Build groups
        const groups = Array.from(groupKeywordMaps.entries())
            .map(([ancestorOid, kwMap]) => {
                const keywords = Array.from(kwMap.values())
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 30)
                    .map(toKeywordItem);
                const totalCount = Array.from(kwMap.values()).reduce((sum, e) => sum + e.total, 0);
                return {
                    service_catalog_oid: ancestorOid,
                    service_catalog_name: ancestorNames.get(ancestorOid) ?? ancestorOid,
                    total_count: totalCount,
                    keywords,
                };
            })
            .sort((a, b) => b.total_count - a.total_count)
            .slice(0, 12);

        const ungroupedKeywords = Array.from(ungroupedKeywordMap.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, 30)
            .map(toKeywordItem);

        const payload: GroupedKeywordHeatmapResponse = {
            generated_at: new Date().toISOString(),
            group_level: groupLevel,
            groups,
            ungrouped_keywords: ungroupedKeywords,
        };
        return NextResponse.json(payload);
    } catch (error) {
        console.error('[survey-analytics/keyword-heatmap]', error);
        return NextResponse.json({ error: 'Failed to aggregate keyword data' }, { status: 500 });
    }
}
