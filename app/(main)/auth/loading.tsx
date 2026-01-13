/**
 * Auth section loading state.
 * Shows while fetching security/auth entities.
 */

import { PageLoading } from '@/components/layout/LoadingSpinner';

export default function Loading() {
    return <PageLoading text="Loading..." />;
}
