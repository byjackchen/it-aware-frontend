import { getIncidentSlaMonthlyReport } from '@/lib/api/objects';
import type { IncidentSlaMonthlyReportData } from '@/lib/types/objects';
import { IncidentSlaMonthly } from './IncidentSlaMonthly';

interface Props {
    searchParams: Promise<{ year?: string }>;
}

export default async function IncidentSlaPage({ searchParams }: Props) {
    const { year } = await searchParams;
    const parsedYear = year ? Number.parseInt(year, 10) : undefined;

    let report: IncidentSlaMonthlyReportData | null = null;
    let error: string | null = null;

    try {
        report = await getIncidentSlaMonthlyReport(Number.isNaN(parsedYear) ? undefined : parsedYear);
    } catch (e) {
        console.error('[IncidentSlaMonthly] Failed to load report:', e instanceof Error ? e.message : e);
        error = e instanceof Error ? e.message : 'Failed to load report';
    }

    return <IncidentSlaMonthly report={report} error={error} />;
}
