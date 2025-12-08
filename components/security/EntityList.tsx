'use client';

/**
 * Generic entity list component with selection support.
 * Client Component - handles click interactions and navigation.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

interface EntityListProps<T> {
  items: T[];
  selectedId?: string;
  baseUrl: string;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string;
  title: string;
  onCreateClick?: () => void;
}

export function EntityList<T>({
  items,
  selectedId,
  baseUrl,
  getId,
  getLabel,
  getSubLabel,
  title,
  onCreateClick,
}: EntityListProps<T>) {
  const router = useRouter();

  const handleCreate = () => {
    if (onCreateClick) {
      onCreateClick();
    } else {
      router.push(`${baseUrl}?selected=__new__`);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
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
          <div className="p-4 text-center text-gray-500">No items found</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {items.map((item) => {
              const id = getId(item);
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
                      {getLabel(item)}
                    </div>
                    {getSubLabel && (
                      <div className="text-sm text-gray-500 truncate">{getSubLabel(item)}</div>
                    )}
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
