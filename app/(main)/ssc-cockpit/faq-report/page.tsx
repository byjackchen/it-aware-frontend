import { getFAQMonthlyReport } from '@/lib/api/objects';
import type { InteractionFAQReport } from '@/lib/types/objects';
import { FAQMonthlyReport } from '@/components/ssc/FAQMonthlyReport';

interface Props {
    searchParams: Promise<{ start_date?: string; end_date?: string }>;
}

export default async function FAQReportRoute({ searchParams }: Props) {
    const { start_date, end_date } = await searchParams;

    let report: InteractionFAQReport | null = null;
    let error: string | null = null;

    try {
        report = await getFAQMonthlyReport(start_date, end_date);
    } catch (e) {
        console.error('[FAQReport] Failed to load report:', e instanceof Error ? e.message : e);
        error = e instanceof Error ? e.message : 'Failed to load report';
    }

    return <FAQMonthlyReport report={report} error={error} />;
}
