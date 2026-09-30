import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const upstream = new URL(`${RUNTIME_CONFIG.backend.domain}/dashboards/survey-analytics/servicenow-quality`);
  for (const key of ['batch_oid', 'start_month', 'end_month', 'timezone']) {
    const value = incoming.searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .filter(({ name, value }) => name.startsWith('it_aware_') && /^[\x00-\x7F]*$/.test(name + value))
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');
  if (!cookieStore.get('it_aware_access')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const response = await fetch(upstream, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    // A gateway error page is not JSON; keep its status instead of turning
    // every such failure into a 502.
    const body = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = { error: response.ok ? 'Invalid response from backend' : `Backend returned ${response.status}` };
      if (response.ok) return NextResponse.json(payload, { status: 502 });
    }
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[survey-analytics/servicenow-quality]', error);
    return NextResponse.json({ error: 'Failed to load ServiceNow quality data' }, { status: 502 });
  }
}
