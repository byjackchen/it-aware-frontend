import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const upstream = new URL(`${RUNTIME_CONFIG.backend.domain}/dashboards/survey-analytics/servicenow-month-details`);
  for (const key of ['batch_oid', 'month', 'timezone', 'page', 'rated_only']) {
    const value = incoming.searchParams.get(key);
    if (value) upstream.searchParams.set(key, value);
  }
  for (const rating of incoming.searchParams.getAll('ratings')) {
    upstream.searchParams.append('ratings', rating);
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
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[survey-analytics/servicenow-month-details]', error);
    return NextResponse.json({ error: 'Failed to load ServiceNow month details' }, { status: 502 });
  }
}
