import { notFound } from 'next/navigation';
import { getClusterSummary, getWorkerClustersPage } from '@/lib/api/clusters';
import { ClusterDetailPage } from './ClusterDetailPage';

interface PageProps {
    params: Promise<{ label: string }>;
}

export default async function ClusterPage({ params }: PageProps) {
    const { label } = await params;
    const clusterLabel = parseInt(label, 10);
    if (isNaN(clusterLabel)) notFound();

    try {
        const [summary, firstPage] = await Promise.all([
            getClusterSummary(),
            getWorkerClustersPage({ cluster_label: clusterLabel, limit: 100 }),
        ]);

        const clusterInfo = summary.clusters.find((c) => c.cluster_label === clusterLabel) ?? null;

        return (
            <ClusterDetailPage
                clusterLabel={clusterLabel}
                clusterInfo={clusterInfo}
                summary={summary}
                initialAssignments={firstPage.items}
                totalAssignments={firstPage.total}
            />
        );
    } catch {
        notFound();
    }
}
