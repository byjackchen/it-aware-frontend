/**
 * Data section loading state.
 * Shows while fetching data entities (workers, locations, etc.).
 */

import { PageLoading } from '@/components/layout/LoadingSpinner';

export default function Loading() {
    return <PageLoading text="Loading data..." />;
}
