'use client';

/**
 * Role create form.
 * Client Component - handles form state and submission.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createRole } from '../actions';

export function RoleForm() {
  const t = useTranslations('Security');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [roleCode, setRoleCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('role_code', roleCode);
    formData.set('name', name);
    formData.set('description', description);

    startTransition(async () => {
      const result = await createRole(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const handleCancel = () => {
    router.push('/security/roles');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{t('roles.createRole')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmit}
            disabled={isPending || !roleCode || !name}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('common.create')}
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 transition-colors"
          >
            <X className="w-4 h-4" />
            {t('common.cancel')}
          </button>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="flex-1 p-4 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Role Code */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              {t('roles.roleCode')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={roleCode}
              onChange={(e) => setRoleCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder={t('roles.roleCodePlaceholder')}
              required
            />
            <p className="mt-1 text-xs text-gray-500">{t('common.uniqueIdentifier')}</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              {t('common.name')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder={t('roles.namePlaceholder')}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">{t('common.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder={t('common.descriptionPlaceholder')}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
