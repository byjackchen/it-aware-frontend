import { cookies } from 'next/headers';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path.length || path.some((part) => !part || part === '.' || part === '..')) {
    return Response.json({ error: 'Invalid path' }, { status: 400 });
  }
  const upstream = new URL(`${RUNTIME_CONFIG.backend.domain}/dashboards/ohla-journey/${path.map(encodeURIComponent).join('/')}`);
  upstream.search = new URL(request.url).search;
  const cookie = (await cookies()).get('it_aware_access');
  if (!cookie) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    const response = await fetch(upstream, { headers: { Cookie: `it_aware_access=${cookie.value}` }, cache: 'no-store' });
    return new Response(await response.text(), { status: response.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Report service unavailable' }, { status: 503 });
  }
}
