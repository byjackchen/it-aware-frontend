import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type {
    DashboardResourceGroup,
    DashboardResourceKey,
    DashboardResourceStats,
    DashboardStatsResponse,
} from '@/lib/types/dashboard';

export const dynamic = 'force-dynamic';

const REQUEST_TIMEOUT_MS = 8000;

interface DashboardResourceConfig {
    key: DashboardResourceKey;
    href: string;
    group: DashboardResourceGroup;
    path: string;
    supportsIsActive: boolean;
}

const RESOURCE_CONFIGS: DashboardResourceConfig[] = [
    {
        key: 'organizations',
        href: '/data/organizations',
        group: 'hierarchies',
        path: '/objects/organizations',
        supportsIsActive: true,
    },
    {
        key: 'locations',
        href: '/data/locations',
        group: 'hierarchies',
        path: '/objects/locations',
        supportsIsActive: true,
    },
    {
        key: 'service-catalogs',
        href: '/data/service-catalogs',
        group: 'hierarchies',
        path: '/objects/service-catalogs',
        supportsIsActive: true,
    },
    {
        key: 'workers',
        href: '/data/workers',
        group: 'objects',
        path: '/objects/workers',
        supportsIsActive: true,
    },
    {
        key: 'articles',
        href: '/data/articles',
        group: 'objects',
        path: '/objects/articles',
        supportsIsActive: true,
    },
    {
        key: 'incidents',
        href: '/data/incidents',
        group: 'activities',
        path: '/objects/activities/incidents',
        supportsIsActive: false,
    },
    {
        key: 'requests',
        href: '/data/requests',
        group: 'activities',
        path: '/objects/activities/requests',
        supportsIsActive: false,
    },
    {
        key: 'inquiries',
        href: '/data/inquiries',
        group: 'activities',
        path: '/objects/activities/inquiries',
        supportsIsActive: false,
    },
    {
        key: 'interactions',
        href: '/data/interactions',
        group: 'activities',
        path: '/objects/activities/interactions',
        supportsIsActive: false,
    },
];

type CountResult =
    | {
        status: 'ok';
        total: number;
    }
    | {
        status: 'forbidden';
    }
    | {
        status: 'error';
    };

function isAscii(value: string): boolean {
    for (let i = 0; i < value.length; i++) {
        if (value.charCodeAt(i) > 127) return false;
    }
    return true;
}

function buildSafeCookieHeader(items: Array<{ name: string; value: string }>): string {
    return items
        .filter((item) => item.name.startsWith('it_aware_'))
        .filter((item) => isAscii(item.name) && isAscii(item.value))
        .map((item) => `${item.name}=${item.value}`)
        .join('; ');
}

function parseTotalFromHeader(headers: Headers): number | null {
    const xTotalCount = headers.get('x-total-count');
    if (xTotalCount) {
        const parsed = Number.parseInt(xTotalCount, 10);
        if (Number.isFinite(parsed) && parsed >= 0) {
            return parsed;
        }
    }

    const contentRange = headers.get('content-range');
    if (!contentRange) return null;

    const match = contentRange.match(/\/(\d+)$/);
    if (!match) return null;

    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
}

function parseTotalFromPayload(payload: unknown): number | null {
    if (!payload || typeof payload !== 'object') return null;

    const total = (payload as { total?: unknown }).total;
    if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) return null;
    return Math.trunc(total);
}

function createFallbackResource(config: DashboardResourceConfig, status: DashboardResourceStats['status']): DashboardResourceStats {
    return {
        key: config.key,
        href: config.href,
        group: config.group,
        total: null,
        active: null,
        inactive: null,
        status,
    };
}

function buildSummary(resources: DashboardResourceStats[]): DashboardStatsResponse['summary'] {
    const okResources = resources.filter((resource) => resource.status === 'ok');

    const totalAcrossResources = okResources.reduce((sum, resource) => {
        return sum + (resource.total ?? 0);
    }, 0);

    const activeCapableResources = okResources.filter((resource) => {
        return resource.active !== null && resource.inactive !== null && resource.total !== null;
    });

    const activeCapableTotal = activeCapableResources.reduce((sum, resource) => sum + (resource.total ?? 0), 0);
    const activeCapableActive = activeCapableResources.reduce((sum, resource) => sum + (resource.active ?? 0), 0);
    const activeCapableInactive = activeCapableResources.reduce((sum, resource) => sum + (resource.inactive ?? 0), 0);

    return {
        total_across_resources: totalAcrossResources,
        active_capable_total: activeCapableTotal,
        active_capable_active: activeCapableActive,
        active_capable_inactive: activeCapableInactive,
        available_resources: okResources.length,
    };
}

async function fetchResourceCount(path: string, cookieHeader: string, isActive?: boolean): Promise<CountResult> {
    const upstreamUrl = new URL(`${RUNTIME_CONFIG.backend.domain}${path}`);
    upstreamUrl.searchParams.set('limit', '1');
    upstreamUrl.searchParams.set('skip', '0');

    if (isActive !== undefined) {
        upstreamUrl.searchParams.set('is_active', String(isActive));
    }

    try {
        const response = await fetch(upstreamUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            cache: 'no-store',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.status === 403) {
            return { status: 'forbidden' };
        }

        if (!response.ok) {
            return { status: 'error' };
        }

        const payload = await response.json().catch(() => null);
        const total = parseTotalFromHeader(response.headers) ?? parseTotalFromPayload(payload);

        if (total === null) {
            return { status: 'error' };
        }

        return {
            status: 'ok',
            total,
        };
    } catch {
        return { status: 'error' };
    }
}

async function collectResourceStats(config: DashboardResourceConfig, cookieHeader: string): Promise<DashboardResourceStats> {
    if (!config.supportsIsActive) {
        const totalResult = await fetchResourceCount(config.path, cookieHeader);

        if (totalResult.status === 'forbidden') {
            return createFallbackResource(config, 'forbidden');
        }

        if (totalResult.status === 'error') {
            return createFallbackResource(config, 'error');
        }

        return {
            key: config.key,
            href: config.href,
            group: config.group,
            total: totalResult.total,
            active: null,
            inactive: null,
            status: 'ok',
        };
    }

    const [totalResult, activeResult] = await Promise.all([
        fetchResourceCount(config.path, cookieHeader),
        fetchResourceCount(config.path, cookieHeader, true),
    ]);

    if (totalResult.status === 'forbidden') {
        return createFallbackResource(config, 'forbidden');
    }

    if (totalResult.status === 'error') {
        return createFallbackResource(config, 'error');
    }

    if (activeResult.status !== 'ok') {
        return {
            key: config.key,
            href: config.href,
            group: config.group,
            total: totalResult.total,
            active: null,
            inactive: null,
            status: activeResult.status === 'forbidden' ? 'forbidden' : 'error',
        };
    }

    const rawInactive = totalResult.total - activeResult.total;
    const inactive = rawInactive >= 0 ? rawInactive : 0;

    if (rawInactive < 0) {
        console.warn(`[dashboard-stats] active count exceeds total for ${config.key}`, {
            total: totalResult.total,
            active: activeResult.total,
        });
    }

    return {
        key: config.key,
        href: config.href,
        group: config.group,
        total: totalResult.total,
        active: activeResult.total,
        inactive,
        status: 'ok',
    };
}

export async function GET() {
    const cookieStore = await cookies();

    if (!cookieStore.get('it_aware_access')) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const cookieHeader = buildSafeCookieHeader(cookieStore.getAll());

    const settled = await Promise.allSettled(
        RESOURCE_CONFIGS.map((config) => collectResourceStats(config, cookieHeader))
    );

    const resources = settled.map((result, index) => {
        const config = RESOURCE_CONFIGS[index];
        if (result.status === 'fulfilled') {
            return result.value;
        }
        return createFallbackResource(config, 'error');
    });

    const payload: DashboardStatsResponse = {
        generated_at: new Date().toISOString(),
        resources,
        summary: buildSummary(resources),
    };

    return NextResponse.json(payload);
}
