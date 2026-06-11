'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

/** Lightweight modal shell used by the Systems CRUD screens. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-lg rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm text-gray-300">{label}</span>
      {children}
      {help ? <span className="mt-1 block text-xs text-gray-500">{help}</span> : null}
    </label>
  );
}

export function FormActions({
  onCancel,
  pending,
}: {
  onCancel: () => void;
  pending: boolean;
}) {
  const t = useTranslations('Systems.common');
  return (
    <div className="mt-5 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg px-4 py-2 text-sm text-gray-300 hover:bg-white/5"
      >
        {t('cancel')}
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-500/20 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
      >
        {pending ? t('saving') : t('save')}
      </button>
    </div>
  );
}

export const inputClass =
  'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-blue-400';
