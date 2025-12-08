/**
 * Permissions page - Server Component.
 * Displays list of permissions with create/edit/delete functionality.
 */

import { getPermissions } from '@/lib/api/security';
import { MasterDetailLayout, EmptyState } from '@/components/security';
import { PermissionList } from './PermissionList';
import { PermissionDetail } from './PermissionDetail';
import { PermissionForm } from './PermissionForm';

interface PageProps {
  searchParams: Promise<{ selected?: string }>;
}

export default async function PermissionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const permissions = await getPermissions();
  const selectedId = params.selected;
  const isCreating = selectedId === '__new__';
  const selected = isCreating ? null : permissions.find((p) => p.permission_code === selectedId);

  return (
    <MasterDetailLayout
      master={<PermissionList items={permissions} selectedId={selectedId} />}
      detail={
        isCreating ? (
          <PermissionForm />
        ) : selected ? (
          <PermissionDetail permission={selected} />
        ) : (
          <EmptyState />
        )
      }
    />
  );
}
