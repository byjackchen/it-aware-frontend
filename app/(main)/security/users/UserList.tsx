'use client';

/**
 * User list component with selection support.
 * Client Component - handles click interactions and navigation.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import type { User } from '@/lib/types/security';

interface UserListProps {
  items: User[];
  selectedId?: string;
}

export function UserList({ items, selectedId }: UserListProps) {
  const router = useRouter();
  const baseUrl = '/security/users';

  const handleCreate = () => {
    router.push(`${baseUrl}?selected=__new__`);
  };

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Users</h2>
        <button
          onClick={handleCreate}
          className="p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
          title="Create new"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No users found</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((user) => {
              const id = user.username;
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
                      {user.full_name || user.username}
                    </div>
                    <div className="text-sm text-gray-500 truncate">
                      {user.email || (user.is_system_user ? 'System User' : user.username)}
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
