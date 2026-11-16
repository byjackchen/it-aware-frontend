import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { SearchResponse } from '@/lib/types/search';

/**
 * API route behind the search bar.
 * GET /api/search?q=<query>&lang=<en|zh>&limit=<limit>
 *
 * It asks the backend's search (GET /search: tasks and records, in groups).
 * A search that fails answers 502 with no groups, so the bar can say that it
 * failed instead of "no results". (The fallback to the record search while the
 * backend's search switch was off went with the switch: ohla-xray TODO00000157.)
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const limit = searchParams.get('limit') || '20';
    const lang = searchParams.get('lang') === 'zh' ? 'zh' : 'en';
    const nothing: SearchResponse = { groups: [] };

    if (!query) {
        return NextResponse.json(nothing);
    }

    try {
        const cookieStore = await cookies();
        // Only forward app cookies to avoid non-ASCII characters in third-party cookies
        const cookieHeader = cookieStore.getAll()
            .filter(c => c.name.startsWith('it_aware_'))
            .map(c => `${c.name}=${c.value}`)
            .join('; ');
        const ask = (path: string, params: Record<string, string>) =>
            fetch(`${RUNTIME_CONFIG.backend.domain}${path}?${new URLSearchParams(params).toString()}`, {
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: cookieHeader,
                },
                cache: 'no-store',
            });

        const search = await ask('/search', { q: query, lang, limit });
        if (search.ok) {
            const data: SearchResponse = await search.json();
            return NextResponse.json({ groups: data.groups });
        }
        console.error('Search failed:', search.status);
        return NextResponse.json(nothing, { status: 502 });
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json(nothing, { status: 502 });
    }
}
