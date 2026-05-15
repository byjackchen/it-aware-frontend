import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_DOMAIN ?? 'http://localhost:8000';

export async function GET(req: NextRequest) {
    const number = req.nextUrl.searchParams.get('number');
    if (!number) {
        return NextResponse.json({ error: 'Missing incident number' }, { status: 400 });
    }

    const accessToken = req.cookies.get('it_aware_access')?.value;
    const backendUrl = `${BACKEND}/services/servicenow/survey?number=${encodeURIComponent(number)}`;

    let res: Response;
    try {
        res = await fetch(backendUrl, {
            headers: {
                ...(accessToken ? { Cookie: `it_aware_access=${accessToken}` } : {}),
                Accept: 'application/json',
            },
            cache: 'no-store',
        });
    } catch (err) {
        console.error('[api/ssc/survey] backend fetch failed:', err);
        return NextResponse.json({ error: 'Failed to reach backend' }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
}
