'use client';

/**
 * User detail view with edit form and role assignments.
 * Client Component - handles form state, submission, and assignments.
 */

import { useState, useTransition } from 'react';
import { Save, Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { User, Role } from '@/lib/types/security';
import { updateUser, deleteUser, assignRoleToUser, removeRoleFromUser } from '../actions';
import { DeleteButton, AssignmentManager } from '@/components/security';

interface UserDetailProps {
  user: User;
  assignedRoles: Role[];
  allRoles: Role[];
}

export function UserDetail({ user, assignedRoles, allRoles }: UserDetailProps) {
  const [email, setEmail] = useState(user.email || '');
  const [fullName, setFullName] = useState(user.full_name || '');
  const [isActive, setIsActive] = useState(user.is_active);
  const [password, setPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    email !== (user.email || '') ||
    fullName !== (user.full_name || '') ||
    isActive !== user.is_active ||
    password !== '';

  const handleSave = () => {
    setError(null);
    const formData = new FormData();
    formData.set('email', email);
    formData.set('full_name', fullName);
    formData.set('is_active', String(isActive));
    if (password) {
      formData.set('password', password);
    }

    startTransition(async () => {
      const result = await updateUser(user.username, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setPassword(''); // Clear password field after successful save
      }
    });
  };

  const handleDelete = async () => {
    await deleteUser(user.username);
  };

  const handleAssignRole = async (roleCode: string) => {
    const result = await assignRoleToUser(user.username, roleCode);
    if (result?.error) {
      setError(result.error);
    }
  };

  const handleRemoveRole = async (roleCode: string) => {
    const result = await removeRoleFromUser(user.username, roleCode);
    if (result?.error) {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">User Details</h2>
          {user.is_active ? (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
              <CheckCircle className="w-3 h-3" /> Active
            </span>
          ) : (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
              <XCircle className="w-3 h-3" /> Inactive
            </span>
          )}
          {user.is_system_user && (
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">
              System User
            </span>
          )}
        </div>
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
          <DeleteButton onDelete={handleDelete} itemName={user.username} />
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
            {/* Username (read-only) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
              <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm">
                {user.username}
              </div>
            </div>

            {/* Full Name (editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Enter full name..."
              />
            </div>

            {/* Email (editable) */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                placeholder="Enter email..."
              />
            </div>

            {/* Active Status */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                />
                <span className="text-sm text-gray-400">Active</span>
              </label>
            </div>

            {/* Password (for system users) */}
            {user.is_system_user && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">
                  Password (API Key)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Enter new password to change..."
                />
                <p className="mt-1 text-xs text-gray-500">Leave empty to keep current password</p>
              </div>
            )}

            {/* Timestamps */}
            {(user.created_at || user.updated_at) && (
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                {user.created_at && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Created At</label>
                    <div className="text-sm text-gray-400">
                      {new Date(user.created_at).toLocaleString()}
                    </div>
                  </div>
                )}
                {user.updated_at && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Updated At</label>
                    <div className="text-sm text-gray-400">
                      {new Date(user.updated_at).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Role Assignments */}
        <AssignmentManager
          title="Roles"
          assigned={assignedRoles}
          available={allRoles}
          getId={(r) => r.role_code}
          getLabel={(r) => r.name}
          onAssign={handleAssignRole}
          onRemove={handleRemoveRole}
        />
      </div>
    </div>
  );
}
