import { getIncidents } from '@/lib/api/objects';
import { IncidentsListPage } from './IncidentsListPage';

export default async function IncidentsPage() {
    const incidents = await getIncidents();

    return <IncidentsListPage incidents={incidents} />;
}
