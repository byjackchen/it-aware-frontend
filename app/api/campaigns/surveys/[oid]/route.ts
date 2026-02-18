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

export async function GET(
    _request: Request,
    context: { params: Promise<{ oid: string }> }
) {
    const { oid } = await context.params;

    try {
        const cookieStore = await cookies();
        const cookieHeader = buildSafeCookieHeader(cookieStore.getAll());

        const response = await fetch(
            `${RUNTIME_CONFIG.backend.domain}/objects/campaigns/surveys/${encodeURIComponent(oid)}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                },
                cache: 'no-store',
            }
        );

        if (!response.ok) {
            return NextResponse.json(
                { error: 'Failed to fetch survey' },
                { status: response.status }
            );
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Failed to proxy /api/campaigns/surveys/[oid]:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
