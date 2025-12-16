/**
 * Groups page - Server Component.
 */

import { getGroups } from '@/lib/api/security';
import { GroupsListPage } from './GroupsListPage';

export default async function GroupsPage() {
    const groups = await getGroups();
    return <GroupsListPage groups={groups} />;
}
