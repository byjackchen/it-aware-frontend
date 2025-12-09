/**
 * Roles page - Server Component.
 * Displays list of roles with create/edit/delete functionality and permission assignments.
 */

import { getRoles, getPermissions, getRolePermissions } from '@/lib/api/security';
import { MasterDetailLayout, EmptyState } from '@/components/security';
import { RoleList } from './RoleList';
import { RoleDetail } from './RoleDetail';
import { RoleForm } from './RoleForm';

interface PageProps {
  searchParams: Promise<{ selected?: string }>;
}

export default async function RolesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [roles, permissions, rolePermissions] = await Promise.all([
    getRoles(),
    getPermissions(),
    getRolePermissions(),
  ]);

  const selectedId = params.selected;
  const isCreating = selectedId === '__new__';
  const selected = isCreating ? null : roles.find((r) => r.role_code === selectedId);

  // Get assigned permissions for selected role
  const assignedPermissionCodes = selected
    ? rolePermissions.filter((rp) => rp.role_code === selected.role_code).map((rp) => rp.permission_code)
    : [];
  const assignedPermissions = permissions.filter((p) => assignedPermissionCodes.includes(p.permission_code));

  return (
    <MasterDetailLayout
      master={<RoleList items={roles} selectedId={selectedId} />}
      detail={
        isCreating ? (
          <RoleForm />
        ) : selected ? (
          <RoleDetail
            key={selected.role_code}
            role={selected}
            assignedPermissions={assignedPermissions}
            allPermissions={permissions}
          />
        ) : (
          <EmptyState />
        )
      }
    />
  );
}
