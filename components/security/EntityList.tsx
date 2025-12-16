'use client';

/**
 * Generic entity list component with selection callback for drawer opening.
 * Client Component - handles click interactions.
 */

import { Plus } from 'lucide-react';

interface EntityListProps<T> {
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string;
  title: string;
  onSelectItem: (item: T) => void;
  onCreateClick: () => void;
}

export function EntityList<T>({
  items,
  getId,
  getLabel,
  getSubLabel,
  title,
  onSelectItem,
  onCreateClick,
}: EntityListProps<T>) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <button
          onClick={onCreateClick}
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
              return (
                <li key={id}>
                  <button
                    onClick={() => onSelectItem(item)}
                    className="w-full text-left block px-4 py-3 transition-colors hover:bg-white/5 border-l-2 border-transparent"
                  >
                    <div className="font-medium text-white">
                      {getLabel(item)}
                    </div>
                    {getSubLabel && (
                      <div className="text-sm text-gray-500 truncate">{getSubLabel(item)}</div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
