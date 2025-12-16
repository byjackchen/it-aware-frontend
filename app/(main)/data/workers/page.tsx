/**
 * Workers list page - Server Component.
 */

import { getWorkers, getOrganizations } from '@/lib/api/objects';
import { WorkersListPage } from './WorkersListPage';

export default async function WorkersPage() {
    const [workers, organizations] = await Promise.all([
        getWorkers(),
        getOrganizations(),
    ]);

    return <WorkersListPage workers={workers} organizations={organizations} />;
}
