import { NextRequest, NextResponse } from 'next/server';
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

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ interaction_oid: string }> },
) {
    const { interaction_oid } = await params;
    const body = await req.text();

    const cookieStore = await cookies();
    const cookieHeader = buildSafeCookieHeader(cookieStore.getAll());

    const upstream = await fetch(
        `${RUNTIME_CONFIG.backend.domain}/objects/activities/interactions/${interaction_oid}/review`,
        {
            method: 'PATCH',
            headers: {
                'content-type': 'application/json',
                ...(cookieHeader ? { cookie: cookieHeader } : {}),
            },
            body,
        },
    );

    const text = await upstream.text();
    return new NextResponse(text, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
}
