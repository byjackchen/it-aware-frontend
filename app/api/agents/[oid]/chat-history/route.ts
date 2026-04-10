/**
 * Proxy for agent chat history: POST /api/agents/{oid}/chat-history
 * → backend POST /objects/agents/{oid}/chat-history
 */
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

function buildCookieHeader(items: Array<{ name: string; value: string }>): string {
    return items
        .filter((item) => item.name.startsWith('it_aware_'))
        .map((item) => `${item.name}=${item.value}`)
        .join('; ');
}

export async function POST(
    request: Request,
    context: { params: Promise<{ oid: string }> }
) {
    const { oid } = await context.params;
    const upstreamUrl = `${RUNTIME_CONFIG.backend.domain}/objects/agents/${oid}/chat-history`;

    const cookieStore = await cookies();
    const cookieHeader = buildCookieHeader(cookieStore.getAll());

    const body = await request.text();

    const response = await fetch(upstreamUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
        body,
        cache: 'no-store',
    });

    if (!response.ok) {
        const errorBody = await response.text();
        return NextResponse.json(
            { error: errorBody || 'Upstream error' },
            { status: response.status }
        );
    }

    const data = await response.json();
    return NextResponse.json(data);
}
