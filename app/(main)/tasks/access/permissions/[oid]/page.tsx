/**
 * Permission detail page - Server Component.
 * Displays a single permission by OID.
 */

import { notFound } from 'next/navigation';
import { getPermission, getGroups, getGroupPermissions } from '@/lib/api/security';
import type { GroupPermission, Group } from '@/lib/types/security';
import { PermissionDetailPage } from './PermissionDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function PermissionPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [permission, groups, groupPermissions] = await Promise.all([
            getPermission(oid),
            getGroups(),
            getGroupPermissions(),
        ]);

        // Get groups assigned to this permission
        const assignedGroupOids = groupPermissions
            .filter((gp: GroupPermission) => gp.permission_oid === oid)
            .map((gp: GroupPermission) => gp.group_oid);
        const assignedGroups = groups.filter((g: Group) => assignedGroupOids.includes(g.oid));

        return (
            <PermissionDetailPage
                permission={permission}
                assignedGroups={assignedGroups}
            />
        );
    } catch (error) {
        console.error('[PermissionPage] Error:', error);
        notFound();
    }
}
