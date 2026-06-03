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

/** Proxy for the chatbot ReAct forwarding endpoint (GET /services/chatbot/react). */
export async function GET(req: NextRequest) {
    const incoming = new URL(req.url);
    const upstream = new URL(`${RUNTIME_CONFIG.backend.domain}/services/chatbot/react`);
    incoming.searchParams.forEach((value, key) => {
        upstream.searchParams.append(key, value);
    });

    const cookieStore = await cookies();
    const cookieHeader = buildSafeCookieHeader(cookieStore.getAll());

    const res = await fetch(upstream.toString(), {
        method: 'GET',
        headers: {
            'content-type': 'application/json',
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        cache: 'no-store',
    });

    const text = await res.text();
    return new NextResponse(text, {
        status: res.status,
        headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
}
