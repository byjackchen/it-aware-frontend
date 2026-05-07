import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

const RESOURCE_PATHS = {
    organizations: '/objects/organizations',
    locations: '/objects/locations',
    workers: '/objects/workers',
    hardwares: '/objects/hardwares',
    'service-catalogs': '/objects/service-catalogs',
    articles: '/objects/articles',
    incidents: '/objects/activities/incidents',
    requests: '/objects/activities/requests',
    inquiries: '/objects/activities/inquiries',
    interactions: '/objects/activities/interactions',
    analysiss: '/objects/insights/analysiss',
    'worker-clusters': '/objects/insights/worker-clusters',
    scenarios: '/objects/journeys/scenarios',
    roles: '/auth/config/roles',
    agents: '/objects/agents',
    tickets: '/objects/agentops/tickets',
    'ioa-scan-workers': '/objects/networks/ioa_scans/workers-with-latest',
} as const;

type ResourceName = keyof typeof RESOURCE_PATHS;

function isResourceName(value: string): value is ResourceName {
    return value in RESOURCE_PATHS;
}

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

function parseContentRangeTotal(contentRange: string | null): string | null {
    if (!contentRange) return null;
    const match = contentRange.match(/\/(\d+)$/);
    if (!match) return null;
    return match[1] ?? null;
}

function parsePayloadTotal(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null;
    const total = (payload as { total?: unknown }).total;
    if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) return null;
    return String(Math.trunc(total));
}

export async function GET(
    request: Request,
    context: { params: Promise<{ resource: string }> }
) {
    const { resource } = await context.params;

    if (!isResourceName(resource)) {
        return NextResponse.json({ error: 'Unsupported resource' }, { status: 400 });
    }

    try {
        const incomingUrl = new URL(request.url);
        const upstreamUrl = new URL(`${RUNTIME_CONFIG.backend.domain}${RESOURCE_PATHS[resource]}`);

        // Forward all query params (limit/skip/is_active/etc.) and default limit for safety.
        incomingUrl.searchParams.forEach((value, key) => {
            upstreamUrl.searchParams.append(key, value);
        });
        if (!upstreamUrl.searchParams.has('limit')) {
            upstreamUrl.searchParams.set('limit', '1000');
        }

        const cookieStore = await cookies();
        const cookieHeader = buildSafeCookieHeader(cookieStore.getAll());

        const response = await fetch(upstreamUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            cache: 'no-store',
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch ${resource}` },
                { status: response.status }
            );
        }

        const data = await response.json();
        const totalHeader = response.headers.get('x-total-count')
            ?? parseContentRangeTotal(response.headers.get('content-range'))
            ?? parsePayloadTotal(data);

        return NextResponse.json(data, {
            headers: totalHeader ? { 'x-total-count': totalHeader } : undefined,
        });
    } catch (error) {
        console.error(`Failed to proxy /api/objects/${resource}:`, error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
