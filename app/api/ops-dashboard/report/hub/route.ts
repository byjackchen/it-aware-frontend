/**
 * Proxy for the Ops Dashboard Hub report endpoint.
 *
 * Maps   GET /api/ops-dashboard/report/hub?...
 * to     GET <BACKEND>/objects/activities/ops-dashboard/report/hub?...
 *
 * Why a separate proxy: /api/objects/[resource] only accepts single-segment
 * paths under /api/objects/, and this URL pattern is rooted at
 * /api/ops-dashboard/. Same precedent as the 5 ohla-chatbot report
 * endpoints at app/api/ohla-chatbot/report/[view]/route.ts.
 *
 * Array params (region_in, country_in, location_in, assigned_group_in,
 * priority_in) are forwarded by repeating the key — `URLSearchParams`
 * preserves the repeats, and FastAPI parses repeated keys as a list.
 */
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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

export async function GET(request: Request) {
    try {
        const incomingUrl = new URL(request.url);
        const upstreamUrl = new URL(
            `${RUNTIME_CONFIG.backend.domain}/objects/activities/ops-dashboard/report/hub`,
        );
        incomingUrl.searchParams.forEach((value, key) => {
            upstreamUrl.searchParams.append(key, value);
        });

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
            const body = await response.text().catch(() => '');
            return NextResponse.json(
                {
                    error: `ops-dashboard/report/hub upstream ${response.status}`,
                    body: body.slice(0, 500),
                },
                { status: response.status },
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Failed to proxy /api/ops-dashboard/report/hub:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
