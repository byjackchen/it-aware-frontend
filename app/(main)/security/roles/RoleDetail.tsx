'use client';

/**
 * Role detail view with edit form and permission assignments.
 * Client Component - handles form state, submission, and assignments.
 */

import { useState, useTransition } from 'react';
import { Save, Loader2 } from 'lucide-react';
import type { Role, Permission } from '@/lib/types/security';
import { updateRole, deleteRole, assignPermissionToRole, removePermissionFromRole } from '../actions';
import { DeleteButton, AssignmentManager } from '@/components/security';

interface RoleDetailProps {
  role: Role;
  assignedPermissions: Permission[];
  allPermissions: Permission[];
}

export function RoleDetail({ role, assignedPermissions, allPermissions }: RoleDetailProps) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasChanges = name !== role.name || description !== role.description;

  const handleSave = () => {
    setError(null);
    const formData = new FormData();
    formData.set('name', name);
    formData.set('description', description);

    startTransition(async () => {
      const result = await updateRole(role.role_code, formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const handleDelete = async () => {
    await deleteRole(role.role_code);
  };

  const handleAssignPermission = async (permissionCode: string) => {
    const result = await assignPermissionToRole(role.role_code, permissionCode);
    if (result?.error) {
      setError(result.error);
    }
  };

  const handleRemovePermission = async (permissionCode: string) => {
    const result = await removePermissionFromRole(role.role_code, permissionCode);
    if (result?.error) {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Role Details</h2>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          )}
          <DeleteButton onDelete={handleDelete} itemName={role.name} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Role Code (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Role Code</label>
              <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm">
                {role.role_code}
              </div>
            </div>

            {/* Name (editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Enter name..."
              />
            </div>

            {/* Description (editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
                placeholder="Enter description..."
              />
            </div>
          </div>
        </div>

        {/* Permission Assignments */}
        <AssignmentManager
          title="Permissions"
          assigned={assignedPermissions}
          available={allPermissions}
          getId={(p) => p.permission_code}
          getLabel={(p) => p.permission_code}
          onAssign={handleAssignPermission}
          onRemove={handleRemovePermission}
        />
      </div>
    </div>
  );
}
