import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { SubmissionOverviewResponse } from '@/lib/types/survey-analytics';

export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 15000;

interface SurveyItem {
    oid: string;
    receiver_oid: string;
    status: string;
}

interface WorkerItem {
    oid: string;
    location_oid: string | null;
}

interface LocationItem {
    oid: string;
    name: string;
    type: string;
    parent_oid: string | null;
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

async function fetchOne<T>(path: string, cookieHeader: string): Promise<T> {
    const url = `${RUNTIME_CONFIG.backend.domain}${path}`;
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Backend error: ${res.status}`);
    return res.json();
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
        const [batch, surveys, workers, locations] = await Promise.all([
            fetchOne<{ oid: string; name: string; status: string; total_count: number }>(
                `/objects/campaigns/survey_batchs/${batchOid}`,
                cookieHeader
            ),
            fetchAll<SurveyItem>(
                `/objects/campaigns/survey_batchs/${batchOid}/surveys`,
                cookieHeader
            ),
            fetchAll<WorkerItem>('/objects/workers', cookieHeader),
            fetchAll<LocationItem>('/objects/locations', cookieHeader),
        ]);

        // Build lookup maps
        const workerLocMap = new Map<string, string | null>();
        for (const w of workers) {
            workerLocMap.set(w.oid, w.location_oid);
        }

        const locMap = new Map<string, LocationItem>();
        for (const l of locations) {
            locMap.set(l.oid, l);
        }

        // Walk up hierarchy to find ancestor by type
        function findAncestor(locOid: string, targetType: string): LocationItem | null {
            let current = locMap.get(locOid);
            while (current) {
                if (current.type === targetType) return current;
                if (!current.parent_oid) break;
                current = locMap.get(current.parent_oid);
            }
            return null;
        }

        function getRegion(locOid: string): string {
            return findAncestor(locOid, 'region')?.name ?? 'Unknown';
        }

        // Roll up location to country level
        function getCountry(locOid: string): { oid: string; name: string } | null {
            const country = findAncestor(locOid, 'country');
            if (country) return { oid: country.oid, name: country.name };
            // If location itself is a country or higher, use it directly
            const loc = locMap.get(locOid);
            if (loc && (loc.type === 'country' || loc.type === 'region')) return { oid: loc.oid, name: loc.name };
            return null;
        }

        // Count by status
        const statusCounts = { submitted: 0, not_started: 0, revoked: 0, expired: 0, total: surveys.length };
        for (const s of surveys) {
            if (s.status === 'submitted') statusCounts.submitted++;
            else if (s.status === 'not_started') statusCounts.not_started++;
            else if (s.status === 'revoked') statusCounts.revoked++;
            else if (s.status === 'expired') statusCounts.expired++;
        }

        // Geo distribution: group surveys by country (rolled up from office/remote locations)
        const geoTotals = new Map<string, { submitted: number; total: number; name: string; region: string }>();

        for (const survey of surveys) {
            const locOid = workerLocMap.get(survey.receiver_oid);
            if (!locOid) continue;

            const country = getCountry(locOid);
            if (!country) continue;

            let entry = geoTotals.get(country.oid);
            if (!entry) {
                entry = { submitted: 0, total: 0, name: country.name, region: getRegion(locOid) };
                geoTotals.set(country.oid, entry);
            }
            entry.total++;
            if (survey.status === 'submitted') entry.submitted++;
        }

        const geoDistribution = Array.from(geoTotals.entries())
            .map(([oid, val]) => ({
                location_oid: oid,
                location_name: val.name,
                region: val.region,
                submitted_count: val.submitted,
                total_count: val.total,
                response_rate: val.total > 0 ? Math.round((val.submitted / val.total) * 1000) / 10 : 0,
            }))
            .sort((a, b) => b.submitted_count - a.submitted_count);

        const responseRate = statusCounts.total > 0
            ? Math.round((statusCounts.submitted / statusCounts.total) * 1000) / 10
            : 0;

        const payload: SubmissionOverviewResponse = {
            generated_at: new Date().toISOString(),
            batch: { oid: batch.oid, name: batch.name, status: batch.status, total_count: batch.total_count },
            status_counts: statusCounts,
            response_rate: responseRate,
            geo_distribution: geoDistribution,
        };

        return NextResponse.json(payload);
    } catch (error) {
        console.error('[survey-analytics/submission-overview]', error);
        return NextResponse.json({ error: 'Failed to aggregate submission data' }, { status: 500 });
    }
}
