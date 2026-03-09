import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { KeywordHeatmapResponse } from '@/lib/types/survey-analytics';

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
}

interface WorkerItem {
    oid: string;
    stable_id: string;
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
        const [analyses, workers] = await Promise.all([
            fetchAll<AnalysisItem>(
                '/objects/insights/analysiss',
                cookieHeader,
                { source_batch_oid: batchOid }
            ),
            fetchAll<WorkerItem>('/objects/workers', cookieHeader),
        ]);

        const workerStableMap = new Map<string, string>();
        for (const w of workers) {
            workerStableMap.set(w.oid, w.stable_id);
        }

        // Group keywords by normalized form, but keep original display form
        const keywordMap = new Map<string, {
            display: string;
            total: number;
            positive: number;
            negative: number;
            neutral: number;
            oids: string[];
            analyses: Array<{ oid: string; topic: string; semantic: string | null; intent: string | null; fact: string | null; worker_stable_id: string }>;
        }>();

        for (const a of analyses) {
            if (!a.keywords) continue;
            for (const kw of a.keywords) {
                const normalized = kw.toLowerCase().trim();
                if (!normalized) continue;

                let entry = keywordMap.get(normalized);
                if (!entry) {
                    entry = { display: kw.trim(), total: 0, positive: 0, negative: 0, neutral: 0, oids: [], analyses: [] };
                    keywordMap.set(normalized, entry);
                }
                entry.total++;
                if (a.semantic === 'positive') entry.positive++;
                else if (a.semantic === 'negative') entry.negative++;
                else entry.neutral++;
                if (entry.oids.length < 5) entry.oids.push(a.oid);
                if (entry.analyses.length < MAX_PREVIEWS) {
                    entry.analyses.push({ oid: a.oid, topic: a.topic, semantic: a.semantic, intent: a.intent, fact: a.fact, worker_stable_id: workerStableMap.get(a.worker_oid) ?? '' });
                }
            }
        }

        const keywords = Array.from(keywordMap.values())
            .sort((a, b) => b.total - a.total)
            .map((entry) => {
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
            });

        const payload: KeywordHeatmapResponse = {
            generated_at: new Date().toISOString(),
            keywords,
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('[survey-analytics/keyword-heatmap]', error);
        return NextResponse.json({ error: 'Failed to aggregate keyword data' }, { status: 500 });
    }
}
