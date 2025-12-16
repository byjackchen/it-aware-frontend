/**
 * Permissions page - Server Component.
 * Fetches data and renders the list with create dialog.
 */

import { getPermissions } from '@/lib/api/security';
import { PermissionsListPage } from './PermissionsListPage';

export default async function PermissionsPage() {
    const permissions = await getPermissions();

    return <PermissionsListPage permissions={permissions} />;
}
