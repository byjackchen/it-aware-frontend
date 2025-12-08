'use client';

/**
 * Delete button with confirmation dialog.
 * Client Component - handles confirmation state and click interactions.
 */

import { useState, useTransition } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteButtonProps {
  onDelete: () => Promise<void>;
  itemName: string;
}

export function DeleteButton({ onDelete, itemName }: DeleteButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await onDelete();
      setShowConfirm(false);
    });
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-400">Delete {itemName}?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-3 py-1.5 text-sm rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="px-3 py-1.5 text-sm rounded-lg bg-white/10 hover:bg-white/20 text-gray-400 transition-colors disabled:opacity-50"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
      title="Delete"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
