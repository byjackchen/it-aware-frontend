/**
 * Users page - Server Component.
 * Displays list of users with create/edit/delete functionality and role assignments.
 */

import { getUsers, getRoles, getUserRoles } from '@/lib/api/security';
import { MasterDetailLayout, EmptyState } from '@/components/security';
import { UserList } from './UserList';
import { UserDetail } from './UserDetail';
import { UserForm } from './UserForm';

interface PageProps {
  searchParams: Promise<{ selected?: string }>;
}

export default async function UsersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [users, roles, userRoles] = await Promise.all([
    getUsers(),
    getRoles(),
    getUserRoles(),
  ]);

  const selectedId = params.selected;
  const isCreating = selectedId === '__new__';
  const selected = isCreating ? null : users.find((u) => u.username === selectedId);

  // Get assigned roles for selected user
  const assignedRoleCodes = selected
    ? userRoles.filter((ur) => ur.username === selected.username).map((ur) => ur.role_code)
    : [];
  const assignedRoles = roles.filter((r) => assignedRoleCodes.includes(r.role_code));

  return (
    <MasterDetailLayout
      master={<UserList items={users} selectedId={selectedId} />}
      detail={
        isCreating ? (
          <UserForm />
        ) : selected ? (
          <UserDetail user={selected} assignedRoles={assignedRoles} allRoles={roles} />
        ) : (
          <EmptyState />
        )
      }
    />
  );
}
