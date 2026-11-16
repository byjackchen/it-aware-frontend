import { getIncidentMonthlyReport } from '@/lib/api/objects';
import type { IncidentMonthlyReportData } from '@/lib/types/objects';
import { IncidentMonthlyReport } from '@/components/ssc/IncidentMonthlyReport';

interface Props {
    searchParams: Promise<{ start_date?: string; end_date?: string }>;
}

export default async function IncidentReportRoute({ searchParams }: Props) {
    const { start_date, end_date } = await searchParams;

    let report: IncidentMonthlyReportData | null = null;
    let error: string | null = null;

    try {
        report = await getIncidentMonthlyReport(start_date, end_date);
    } catch (e) {
        console.error('[IncidentReport] Failed to load report:', e instanceof Error ? e.message : e);
        error = e instanceof Error ? e.message : 'Failed to load report';
    }

    return <IncidentMonthlyReport report={report} error={error} />;
}
