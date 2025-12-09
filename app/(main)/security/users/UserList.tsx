'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { User } from '@/lib/types/security';

interface UserListProps {
  items: User[];
  selectedId?: string;
}

export function UserList({ items, selectedId }: UserListProps) {
  const t = useTranslations('Security');
  const router = useRouter();
  const baseUrl = '/security/users';

  const handleCreate = () => {
    router.push(`${baseUrl}?selected=__new__`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b theme-border-panel flex items-center justify-between">
        <h2 className="text-lg font-semibold theme-text-primary">{t('users.title')}</h2>
        <button
          onClick={handleCreate}
          className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          title={t('users.createUser')}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-center theme-text-muted">{t('users.noUsersFound')}</div>
        ) : (
          <ul className="theme-divide">
            {items.map((user) => {
              const id = user.username;
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
                      {user.full_name || user.username}
                    </div>
                    <div className="text-sm theme-text-muted truncate">
                      {user.email || user.username}
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
