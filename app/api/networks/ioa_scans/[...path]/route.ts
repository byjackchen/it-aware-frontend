/**
 * Catch-all proxy for /api/networks/ioa_scans/* → backend
 * /objects/networks/ioa_scans/*. Mirrors the agentops proxy pattern.
 *
 * Used by client components — server-rendered reads bypass this and call
 * the backend directly via lib/api/networks/ioa_scans.ts.
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

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

async function proxyRequest(
    request: Request,
    pathSegments: string[],
    method: string,
): Promise<NextResponse> {
    const backendPath = `/objects/networks/ioa_scans/${pathSegments.join('/')}`;
    const incomingUrl = new URL(request.url);
    const upstreamUrl = new URL(`${RUNTIME_CONFIG.backend.domain}${backendPath}`);

    incomingUrl.searchParams.forEach((value, key) => {
        upstreamUrl.searchParams.append(key, value);
    });

    const cookieStore = await cookies();
    const cookieHeader = buildSafeCookieHeader(cookieStore.getAll());

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
    };

    const fetchOptions: RequestInit = {
        method,
        headers,
        cache: 'no-store',
    };

    if (method !== 'GET' && method !== 'DELETE') {
        try {
            fetchOptions.body = await request.text();
        } catch {
            // no body
        }
    }

    const response = await fetch(upstreamUrl.toString(), fetchOptions);

    if (method === 'DELETE' && response.status === 204) {
        return new NextResponse(null, { status: 204 });
    }

    if (!response.ok) {
        const errorBody = await response.text();
        return NextResponse.json(
            { error: errorBody || 'Upstream error' },
            { status: response.status },
        );
    }

    const data = await response.json();
    return NextResponse.json(data);
}

export async function GET(
    request: Request,
    context: { params: Promise<{ path: string[] }> },
) {
    const { path } = await context.params;
    return proxyRequest(request, path, 'GET');
}

export async function POST(
    request: Request,
    context: { params: Promise<{ path: string[] }> },
) {
    const { path } = await context.params;
    return proxyRequest(request, path, 'POST');
}
