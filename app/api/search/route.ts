import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

/**
 * API route to proxy registry search requests.
 * GET /api/search?q=<query>&limit=<limit>
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = searchParams.get('limit') || '20';

    if (!query || query.trim().length === 0) {
        return NextResponse.json([]);
    }

    try {
        const cookieStore = await cookies();
        // Only forward app cookies to avoid non-ASCII characters in third-party cookies
        const cookieHeader = cookieStore.getAll()
            .filter(c => c.name.startsWith('it_aware_'))
            .map(c => `${c.name}=${c.value}`)
            .join('; ');

        const params = new URLSearchParams({
            q: query.trim(),
            limit,
        });

        const response = await fetch(
            `${RUNTIME_CONFIG.backend.domain}/objects/registry/search?${params.toString()}`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: cookieHeader,
                },
                cache: 'no-store',
            }
        );

        if (!response.ok) {
            console.error('Registry search failed:', response.status);
            return NextResponse.json([]);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Registry search error:', error);
        return NextResponse.json([]);
    }
}
