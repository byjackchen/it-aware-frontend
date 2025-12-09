'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Role } from '@/lib/types/security';

interface RoleListProps {
  items: Role[];
  selectedId?: string;
}

export function RoleList({ items, selectedId }: RoleListProps) {
  const t = useTranslations('Security');
  const router = useRouter();
  const baseUrl = '/security/roles';

  const handleCreate = () => {
    router.push(`${baseUrl}?action=create`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b theme-border-panel flex items-center justify-between">
        <h2 className="text-lg font-semibold theme-text-primary">{t('roles.title')}</h2>
        <button
          onClick={handleCreate}
          className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          title={t('roles.createRole')}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-center theme-text-muted">{t('roles.noRolesFound')}</div>
        ) : (
          <ul className="theme-divide">
            {items.map((role) => {
              const id = role.role_code;
              const isSelected = id === selectedId;
              return (
                <li key={id}>
                  <Link
                    href={`${baseUrl}?selected=${encodeURIComponent(id)}`}
                    className={`block px-4 py-3 transition-colors ${
                      isSelected
                        ? 'theme-list-selected border-l-2 border-blue-500'
                        : 'theme-list-hover border-l-2 border-transparent'
                    }`}
                  >
                    <div className={`font-medium ${isSelected ? 'text-blue-500' : 'theme-text-primary'}`}>
                      {role.name}
                    </div>
                    <div className="text-sm theme-text-muted truncate">
                      {role.role_code}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
