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
import { getTaskAccess } from '@/lib/api/tasks';
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
        const [group, permissions, roles, groupPermissions, groupRoles, access] = await Promise.all([
            getGroup(oid),
            getPermissions(),
            getRoles(),
            getGroupPermissions(oid),
            getGroupRoles(oid),
            // The catalog's tasks, for the home tasks; null for an admin who may not read them.
            getTaskAccess().catch(() => null),
        ]);

        // Get assigned permissions
        const assignedPermissionOids = groupPermissions.map((gp: GroupPermission) => gp.permission_oid);
        const assignedPermissions = permissions.filter((p: Permission) => assignedPermissionOids.includes(p.oid));

        // Get linked roles
        const linkedRoleOids = groupRoles.map((gr: GroupRole) => gr.role_oid);
        const linkedRoles = roles.filter((r: Role) => linkedRoleOids.includes(r.oid));

        props = {
            group,
            assignedPermissions,
            allPermissions: permissions,
            linkedRoles,
            allRoles: roles,
            tasks: access?.tasks ?? null,
        };
    } catch {
        notFound();
    }

    return <GroupDetailPage {...props} />;
}
