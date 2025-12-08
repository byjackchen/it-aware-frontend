'use client';

/**
 * Assignment manager component for managing role-permission or user-role assignments.
 * Client Component - handles assignment interactions.
 */

import { useState, useTransition } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';

interface AssignmentManagerProps<T> {
  title: string;
  assigned: T[];
  available: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  onAssign: (id: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

export function AssignmentManager<T>({
  title,
  assigned,
  available,
  getId,
  getLabel,
  onAssign,
  onRemove,
}: AssignmentManagerProps<T>) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Filter out already assigned items from available
  const assignedIds = new Set(assigned.map(getId));
  const unassigned = available.filter((item) => !assignedIds.has(getId(item)));

  const handleAssign = () => {
    if (!selectedId) return;
    setPendingId(selectedId);
    startTransition(async () => {
      await onAssign(selectedId);
      setSelectedId('');
      setIsAdding(false);
      setPendingId(null);
    });
  };

  const handleRemove = (id: string) => {
    setPendingId(id);
    startTransition(async () => {
      await onRemove(id);
      setPendingId(null);
    });
  };

  return (
    <div className="border-t border-white/10 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">{title}</h3>
        {!isAdding && unassigned.length > 0 && (
          <button
            onClick={() => setIsAdding(true)}
            className="p-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
            title={`Add ${title.toLowerCase()}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Add new assignment */}
      {isAdding && (
        <div className="flex items-center gap-2 mb-3">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">Select...</option>
            {unassigned.map((item) => (
              <option key={getId(item)} value={getId(item)}>
                {getLabel(item)}
              </option>
            ))}
          </select>
          <button
            onClick={handleAssign}
            disabled={!selectedId || isPending}
            className="px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm transition-colors disabled:opacity-50"
          >
            {isPending && pendingId === selectedId ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Add'
            )}
          </button>
          <button
            onClick={() => {
              setIsAdding(false);
              setSelectedId('');
            }}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Assigned items */}
      {assigned.length === 0 ? (
        <div className="text-sm text-gray-500">No {title.toLowerCase()} assigned</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assigned.map((item) => {
            const id = getId(item);
            return (
              <div
                key={id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
              >
                <span className="text-sm text-white">{getLabel(item)}</span>
                <button
                  onClick={() => handleRemove(id)}
                  disabled={isPending && pendingId === id}
                  className="p-0.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  {isPending && pendingId === id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
