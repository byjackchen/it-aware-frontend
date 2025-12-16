/**
 * Group detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import {
    getGroup,
    getPermissions,
    getRoles,
    getGroupPermissions,
    getGroupRoles,
} from '@/lib/api/security';
import { GroupDetailPage } from './GroupDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function GroupPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [group, permissions, roles, groupPermissions, groupRoles] = await Promise.all([
            getGroup(oid),
            getPermissions(),
            getRoles(),
            getGroupPermissions(oid),
            getGroupRoles(oid),
        ]);

        // Get assigned permissions
        const assignedPermissionOids = groupPermissions.map((gp) => gp.permission_oid);
        const assignedPermissions = permissions.filter((p) => assignedPermissionOids.includes(p.oid));

        // Get linked roles
        const linkedRoleOids = groupRoles.map((gr) => gr.role_oid);
        const linkedRoles = roles.filter((r) => linkedRoleOids.includes(r.oid));

        return (
            <GroupDetailPage
                group={group}
                assignedPermissions={assignedPermissions}
                allPermissions={permissions}
                linkedRoles={linkedRoles}
                allRoles={roles}
            />
        );
    } catch {
        notFound();
    }
}
