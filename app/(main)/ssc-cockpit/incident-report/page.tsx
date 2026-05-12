import { getIncidentMonthlyReport } from '@/lib/api/objects';
import type { IncidentMonthlyReportData } from '@/lib/types/objects';
import { IncidentMonthlyReport } from '@/components/ssc/IncidentMonthlyReport';

interface Props {
    searchParams: Promise<{ start_date?: string; end_date?: string; tz?: string }>;
}

export default async function IncidentReportRoute({ searchParams }: Props) {
    const { start_date, end_date, tz } = await searchParams;

    let report: IncidentMonthlyReportData | null = null;
    let error: string | null = null;

    try {
        // First page-load has no tz in URL; backend falls back to UTC.
        // After the analyst interacts with DateRangeControls, the URL carries
        // their detected IANA tz and subsequent loads are TZ-aware.
        report = await getIncidentMonthlyReport(start_date, end_date, tz);
    } catch (e) {
        console.error('[IncidentReport] Failed to load report:', e instanceof Error ? e.message : e);
        error = e instanceof Error ? e.message : 'Failed to load report';
    }

    return <IncidentMonthlyReport report={report} error={error} />;
}
