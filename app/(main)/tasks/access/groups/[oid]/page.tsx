/**
 * Group detail page - Server Component.
 */

import type { ComponentProps } from 'react';
import { notFound } from 'next/navigation';
import {
    getGroup,
    getPermissions,
    getRoles,
    getGroupPermissions,
    getGroupRoles,
} from '@/lib/api/security';
import type { GroupPermission, GroupRole, Permission, Role } from '@/lib/types/security';
import { GroupDetailPage } from './GroupDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function GroupPage({ params }: PageProps) {
    const { oid } = await params;

    // Built outside the try: React renders after this returns, so a try cannot catch its errors.
    let props: ComponentProps<typeof GroupDetailPage>;
    try {
        const [group, permissions, roles, groupPermissions, groupRoles] = await Promise.all([
            getGroup(oid),
            getPermissions(),
            getRoles(),
            getGroupPermissions(oid),
            getGroupRoles(oid),
        ]);

        // Get assigned permissions
        const assignedPermissionOids = groupPermissions.map((gp: GroupPermission) => gp.permission_oid);
        const assignedPermissions = permissions.filter((p: Permission) => assignedPermissionOids.includes(p.oid));

        // Get linked roles
        const linkedRoleOids = groupRoles.map((gr: GroupRole) => gr.role_oid);
        const linkedRoles = roles.filter((r: Role) => linkedRoleOids.includes(r.oid));

        props = { group, assignedPermissions, allPermissions: permissions, linkedRoles, allRoles: roles };
    } catch {
        notFound();
    }

    return <GroupDetailPage {...props} />;
}
