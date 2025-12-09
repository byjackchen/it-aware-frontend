'use client';

import { useState, useTransition } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DeleteButtonProps {
  onDelete: () => Promise<void>;
  itemName: string;
}

export function DeleteButton({ onDelete, itemName }: DeleteButtonProps) {
  const t = useTranslations('Security');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await onDelete();
    });
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-400">{t('common.confirmDelete')}</span>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="px-3 py-1.5 text-sm rounded-lg theme-btn-neutral disabled:opacity-50"
        >
          {t('common.no')}
        </button>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-3 py-1.5 text-sm rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.yes')}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="p-2 rounded-lg text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
      title={t('common.delete')}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
