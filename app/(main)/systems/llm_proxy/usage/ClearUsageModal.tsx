'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Trash2 } from 'lucide-react';
import type { UsageFilters } from '@/lib/api/systems';
import { countUsage } from '@/app/actions/systems';
import { useTheme } from '@/lib/contexts/theme-context';
import { inputClass } from '../_components/Modal';
import { WINDOW_HOURS, dayBound } from './filters';

interface ClearUsageModalProps {
  isOpen: boolean;
  mode: 'filtered' | 'all';
  taskKeys: string[];
  models: string[];
  isPending: boolean; // delete in-flight (owned by parent transition)
  error: string | null; // delete error (owned by parent)
  onCancel: () => void;
  onConfirm: (filters: UsageFilters) => void; // 'all' → {}; 'filtered' → built filters
}

export function ClearUsageModal({
  isOpen,
  mode,
  taskKeys,
  models,
  isPending,
  error,
  onCancel,
  onConfirm,
}: ClearUsageModalProps) {
  const t = useTranslations('Systems');
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Modal owns its own filter selection — independent of the top filter bar.
  const [window, setWindow] = useState('7d');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [taskKey, setTaskKey] = useState('');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('');
  const [typed, setTyped] = useState(''); // type-to-confirm (mode 'all' only)
  const [count, setCount] = useState<number | null>(null);
  const [counting, startCount] = useTransition();

  // Reset to defaults each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setWindow('7d');
    setFrom('');
    setTo('');
    setTaskKey('');
    setModel('');
    setStatus('');
    setTyped('');
    setCount(null);
  }, [isOpen]);

  // Esc to close (inert while a delete is in flight).
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isPending) onCancel();
    };
    globalThis.addEventListener('keydown', handleKey);
    return () => globalThis.removeEventListener('keydown', handleKey);
  }, [isOpen, isPending, onCancel]);

  const buildFilters = (): UsageFilters => {
    const base: UsageFilters = {
      task_key: taskKey || undefined,
      model_name: model || undefined,
      status: status || undefined,
    };
    return window === 'custom'
      ? { ...base, created_from: dayBound(from || undefined, false), created_to: dayBound(to || undefined, true) }
      : { ...base, window_hours: WINDOW_HOURS[window] ?? 168 };
  };

  // Live delete-count preview (debounced). `typed` intentionally excluded.
  useEffect(() => {
    if (!isOpen) return;
    const filters = mode === 'all' ? {} : buildFilters();
    const handle = setTimeout(() => {
      startCount(async () => {
        const res = await countUsage(filters);
        setCount('data' in res ? res.data : null);
      });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, window, from, to, taskKey, model, status]);

  if (!isOpen) return null;

  const expectedWord = t('usage.confirmWord');
  const typedOk = mode === 'filtered' || typed.trim() === expectedWord;
  const confirmDisabled =
    isPending || !typedOk || count === 0 || (count === null && counting);

  const title = mode === 'all' ? t('usage.clearAllTitle') : t('usage.clearFilteredTitle');
  const description = mode === 'all' ? t('usage.clearAllDesc') : t('usage.clearFilteredDesc');
  const confirmLabel = mode === 'all' ? t('usage.clearConfirmAll') : t('usage.clearConfirmFiltered');

  const labelClass = `flex flex-col gap-1 text-xs ${isLight ? 'text-slate-600' : 'text-gray-400'}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => {
        if (!isPending) onCancel();
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className={`w-full max-w-lg space-y-4 rounded-xl border p-5 shadow-xl ${
          isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2 className={`text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {title}
            </h2>
            <p className={`mt-1 text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
              {description}
            </p>
          </div>
        </div>

        {/* Filter selectors (filtered mode only) */}
        {mode === 'filtered' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className={labelClass}>
              {t('usage.filterWindow')}
              <select className={inputClass} value={window} onChange={(e) => setWindow(e.target.value)}>
                <option value="24h">{t('usage.window24h')}</option>
                <option value="7d">{t('usage.window7d')}</option>
                <option value="30d">{t('usage.window30d')}</option>
                <option value="custom">{t('usage.windowCustom')}</option>
              </select>
            </label>

            {window === 'custom' && (
              <>
                <label className={labelClass}>
                  {t('usage.from')}
                  <input
                    type="date"
                    className={inputClass}
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label className={labelClass}>
                  {t('usage.to')}
                  <input
                    type="date"
                    className={inputClass}
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </>
            )}

            <label className={labelClass}>
              {t('usage.taskKey')}
              <select className={inputClass} value={taskKey} onChange={(e) => setTaskKey(e.target.value)}>
                <option value="">{t('usage.allTasks')}</option>
                {taskKeys.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              {t('usage.model')}
              <select className={inputClass} value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">{t('usage.allModels')}</option>
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass}>
              {t('usage.status')}
              <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">{t('usage.allStatus')}</option>
                <option value="ok">ok</option>
                <option value="error">error</option>
              </select>
            </label>
          </div>
        )}

        {/* Delete preview */}
        <p
          className={`text-sm ${
            counting && count === null
              ? isLight
                ? 'text-slate-500'
                : 'text-gray-400'
              : count === 0
                ? isLight
                  ? 'text-slate-400'
                  : 'text-gray-500'
                : 'text-rose-400'
          }`}
        >
          {counting && count === null ? t('usage.counting') : t('usage.willDelete', { n: count ?? 0 })}
        </p>

        {/* Type-to-confirm (all mode only) */}
        {mode === 'all' && (
          <div>
            <label className={`mb-1 block text-xs ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
              {t('usage.confirmTypeLabel', { word: expectedWord })}
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={isPending}
              autoFocus
              className={`w-full rounded-md border px-2 py-1.5 text-sm ${
                isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'
              } disabled:opacity-60`}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              isLight
                ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                : 'border-white/10 text-gray-200 hover:bg-white/10'
            } disabled:opacity-60`}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(mode === 'all' ? {} : buildFilters())}
            disabled={confirmDisabled}
            className="inline-flex items-center gap-2 rounded-md border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
