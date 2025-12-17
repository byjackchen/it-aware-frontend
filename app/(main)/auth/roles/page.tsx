/**
 * Roles page - Server Component.
 */

import { getRoles } from '@/lib/api/security';
import { RolesListPage } from './RolesListPage';

export default async function RolesPage() {
    const roles = await getRoles();
    return <RolesListPage roles={roles} />;
}
