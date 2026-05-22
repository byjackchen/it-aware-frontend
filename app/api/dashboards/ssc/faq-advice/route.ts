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

export async function POST(req: NextRequest) {
    const cookieStore = await cookies();
    const cookieHeader = buildSafeCookieHeader(cookieStore.getAll());

    const body = await req.json();

    const upstream = await fetch(
        `${RUNTIME_CONFIG.backend.domain}/dashboards/ssc/faq-advice`,
        {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...(cookieHeader ? { cookie: cookieHeader } : {}),
            },
            body: JSON.stringify(body),
            cache: 'no-store',
        },
    );

    const text = await upstream.text();
    return new NextResponse(text, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
    });
}
