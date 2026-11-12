/**
 * Role detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getRole, getGroups, getGroupRoles } from '@/lib/api/security';
import type { GroupRole, Group } from '@/lib/types/security';
import { RoleDetailPage } from './RoleDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function RolePage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [role, groups, groupRoles] = await Promise.all([
            getRole(oid),
            getGroups(),
            getGroupRoles(),
        ]);

        // Get groups linked to this role
        const linkedGroupOids = groupRoles
            .filter((gr: GroupRole) => gr.role_oid === oid)
            .map((gr: GroupRole) => gr.group_oid);
        const linkedGroups = groups.filter((g: Group) => linkedGroupOids.includes(g.oid));

        return (
            <RoleDetailPage
                role={role}
                linkedGroups={linkedGroups}
            />
        );
    } catch {
        notFound();
    }
}
