'use client';

/**
 * Permission detail view with edit form.
 * Client Component - handles form state and submission.
 */

import { useState, useTransition } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Permission } from '@/lib/types/security';
import { updatePermission, deletePermission } from '../actions';
import { DeleteButton } from '@/components/security';

interface PermissionDetailProps {
  permission: Permission;
}

export function PermissionDetail({ permission }: PermissionDetailProps) {
  const t = useTranslations('Security');
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
      <div className="p-4 border-b theme-border-panel flex items-center justify-between">
        <h2 className="text-lg font-semibold theme-text-primary">{t('permissions.details')}</h2>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('common.save')}
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
            <label className="block text-sm font-medium mb-1 theme-text-label">{t('permissions.permissionCode')}</label>
            <div className="px-3 py-2 rounded-lg font-mono text-sm theme-input-readonly">
              {permission.permission_code}
            </div>
          </div>

          {/* Domain (read-only) */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 theme-text-label">{t('permissions.domain')}</label>
              <div className="px-3 py-2 rounded-lg text-sm theme-input-readonly">
                {permission.domain}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 theme-text-label">{t('permissions.resource')}</label>
              <div className="px-3 py-2 rounded-lg text-sm theme-input-readonly">
                {permission.resource}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 theme-text-label">{t('permissions.action')}</label>
              <div className="px-3 py-2 rounded-lg text-sm theme-input-readonly">
                {permission.action}
              </div>
            </div>
          </div>

          {/* Description (editable) */}
          <div>
            <label className="block text-sm font-medium mb-1 theme-text-label">{t('common.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none theme-input"
              placeholder={t('common.descriptionPlaceholder')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
