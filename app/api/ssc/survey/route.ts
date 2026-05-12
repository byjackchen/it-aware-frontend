import { NextRequest, NextResponse } from 'next/server';

const SN_URL = process.env.SERVICENOW_URL ?? 'https://tencent.service-now.com';
const SN_USER = process.env.SERVICENOW_USERNAME ?? '';
const SN_PASS = process.env.SERVICENOW_PASSWORD ?? '';

export async function GET(req: NextRequest) {
    const number = req.nextUrl.searchParams.get('number')?.trim().toUpperCase();

    if (!number || !/^INC\d+$/.test(number)) {
        return NextResponse.json({ error: 'Invalid incident number. Expected format: INCxxxxxxx' }, { status: 400 });
    }

    const token = Buffer.from(`${SN_USER}:${SN_PASS}`).toString('base64');
    const url = `${SN_URL}/api/tenam/incident_assessment/survey?number=${encodeURIComponent(number)}`;

    let snRes: Response;
    try {
        snRes = await fetch(url, {
            headers: { Authorization: `Basic ${token}`, Accept: 'application/json' },
            cache: 'no-store',
        });
    } catch (err) {
        console.error('[ssc/survey] ServiceNow fetch failed:', err);
        return NextResponse.json({ error: 'Failed to reach ServiceNow' }, { status: 502 });
    }

    if (!snRes.ok) {
        console.error(`[ssc/survey] ServiceNow returned ${snRes.status} for ${number}`);
        return NextResponse.json({ error: `ServiceNow returned ${snRes.status}` }, { status: 502 });
    }

    const data = await snRes.json();
    const incident = data?.result?.incident_list?.[0] ?? null;

    if (!incident) {
        return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }

    const surveys = (incident.survey_list ?? []).map((s: Record<string, unknown>) => ({
        number: s.number,
        state: s.state,
        due_date: s.due_date,
        assigned_to: s.assigned_to,
        url: s.view_instance_url,
    }));

    return NextResponse.json({
        incident: {
            number: incident.incident_number,
            description: incident.short_description,
            state: incident.state,
            caller: incident.caller_id,
        },
        surveys,
    });
}
