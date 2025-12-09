'use client';

/**
 * Permission list component with selection support.
 * Client Component - handles click interactions and navigation.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Permission } from '@/lib/types/security';

interface PermissionListProps {
  items: Permission[];
  selectedId?: string;
}

export function PermissionList({ items, selectedId }: PermissionListProps) {
  const t = useTranslations('Security');
  const router = useRouter();
  const baseUrl = '/security/permissions';

  const handleCreate = () => {
    router.push(`${baseUrl}?selected=__new__`);
  };

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{t('permissions.title')}</h2>
        <button
          onClick={handleCreate}
          className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
          title={t('common.create')}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-center text-gray-500">{t('permissions.noPermissionsFound')}</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((permission) => {
              const id = permission.permission_code;
              const isSelected = id === selectedId;
              return (
                <li key={id}>
                  <Link
                    href={`${baseUrl}?selected=${encodeURIComponent(id)}`}
                    className={`block px-4 py-3 transition-colors ${
                      isSelected
                        ? 'bg-blue-500/20 border-l-2 border-blue-500'
                        : 'hover:bg-white/5 border-l-2 border-transparent'
                    }`}
                  >
                    <div className={`font-medium ${isSelected ? 'text-blue-400' : 'text-white'}`}>
                      {permission.permission_code}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {permission.description}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
