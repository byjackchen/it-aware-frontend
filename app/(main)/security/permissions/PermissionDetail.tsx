'use client';

/**
 * Permission detail view with edit form.
 * Client Component - handles form state and submission.
 */

import { useState, useTransition } from 'react';
import { Save, Loader2 } from 'lucide-react';
import type { Permission } from '@/lib/types/security';
import { updatePermission, deletePermission } from '../actions';
import { DeleteButton } from '@/components/security';

interface PermissionDetailProps {
  permission: Permission;
}

export function PermissionDetail({ permission }: PermissionDetailProps) {
  const [description, setDescription] = useState(permission.description);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasChanges = description !== permission.description;

  const handleSave = () => {
    setError(null);
    const formData = new FormData();
    formData.set('description', description);

    startTransition(async () => {
      const result = await updatePermission(permission.permission_code, formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const handleDelete = async () => {
    await deletePermission(permission.permission_code);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Permission Details</h2>
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
          <DeleteButton onDelete={handleDelete} itemName={permission.permission_code} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Permission Code (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Permission Code</label>
            <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-sm">
              {permission.permission_code}
            </div>
          </div>

          {/* Domain (read-only) */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Domain</label>
              <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                {permission.domain}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Resource</label>
              <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                {permission.resource}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Action</label>
              <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                {permission.action}
              </div>
            </div>
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
    </div>
  );
}
