'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BarChart3, Trash2 } from 'lucide-react';
import type { LLMUsage, LLMUsageAggregateRow } from '@/lib/types/systems';
import type { UsageFilters } from '@/lib/api/systems';
import { clearUsage } from '@/app/actions/systems';
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
import { inputClass } from '../_components/Modal';
import { FieldHint } from './FieldHint';
import { ClearUsageModal } from './ClearUsageModal';

interface Current {
  window: string;
  task_key?: string;
  model?: string;
  status?: string;
  from?: string;
  to?: string;
}

interface Props {
  usage: LLMUsage[];
  aggregate: LLMUsageAggregateRow[];
  taskKeys: string[];
  models: string[];
  current: Current;
}

export function UsageClient({ usage, aggregate, taskKeys, models, current }: Props) {
  const t = useTranslations('Systems');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission(PERMISSIONS.SYSTEMS.LLM_PROXY_WRITE);
  const [pending, startTransition] = useTransition();
  const [cleared, setCleared] = useState<number | null>(null);
  const [clearMode, setClearMode] = useState<null | 'filtered' | 'all'>(null);
  const [clearError, setClearError] = useState<string | null>(null);

  const updateParams = (updates: Record<string, string | undefined>) => {
    const qs = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) qs.set(k, v);
      else qs.delete(k);
    }
    setCleared(null);
    startTransition(() => router.replace(`?${qs.toString()}`));
  };

  const handleConfirmClear = (filters: UsageFilters) => {
    setClearError(null);
    startTransition(async () => {
      const res = await clearUsage(filters);
      if ('data' in res) {
        setCleared(res.data.deleted);
        setClearMode(null);
        router.refresh();
      } else {
        setClearError(res.error);
      }
    });
  };

  const labelClass = 'flex flex-col gap-1 text-xs text-gray-400';

  return (
    <div className="h-[calc(100vh-4rem)] space-y-4 overflow-auto p-4">
      {/* ── Filter + clear bar ─────────────────────────────────────────── */}
      <div className="rounded-xl glass-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className={labelClass}>
            {t('usage.filterWindow')}
            <select
              className={inputClass}
              value={current.window}
              onChange={(e) =>
                updateParams(
                  e.target.value === 'custom'
                    ? { window: 'custom' }
                    : { window: e.target.value, from: undefined, to: undefined }
                )
              }
            >
              <option value="24h">{t('usage.window24h')}</option>
              <option value="7d">{t('usage.window7d')}</option>
              <option value="30d">{t('usage.window30d')}</option>
              <option value="custom">{t('usage.windowCustom')}</option>
            </select>
          </label>

          {current.window === 'custom' && (
            <>
              <label className={labelClass}>
                {t('usage.from')}
                <input
                  type="date"
                  className={inputClass}
                  value={current.from ?? ''}
                  onChange={(e) => updateParams({ from: e.target.value || undefined })}
                />
              </label>
              <label className={labelClass}>
                {t('usage.to')}
                <input
                  type="date"
                  className={inputClass}
                  value={current.to ?? ''}
                  onChange={(e) => updateParams({ to: e.target.value || undefined })}
                />
              </label>
            </>
          )}

          <label className={labelClass}>
            {t('usage.taskKey')}
            <select
              className={inputClass}
              value={current.task_key ?? ''}
              onChange={(e) => updateParams({ task_key: e.target.value || undefined })}
            >
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
            <select
              className={inputClass}
              value={current.model ?? ''}
              onChange={(e) => updateParams({ model: e.target.value || undefined })}
            >
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
            <select
              className={inputClass}
              value={current.status ?? ''}
              onChange={(e) => updateParams({ status: e.target.value || undefined })}
            >
              <option value="">{t('usage.allStatus')}</option>
              <option value="ok">ok</option>
              <option value="error">error</option>
            </select>
          </label>

          {canWrite && (
            <div className="ml-auto flex items-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setClearError(null);
                  setClearMode('filtered');
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {t('usage.clearFiltered')}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setClearError(null);
                  setClearMode('all');
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300 hover:bg-red-500/25 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {t('usage.clearAll')}
              </button>
            </div>
          )}
        </div>
        {cleared != null && (
          <p className="mt-2 text-xs text-green-400">{t('usage.cleared', { n: cleared })}</p>
        )}
      </div>

      {/* ── Summary (aggregate) ────────────────────────────────────────── */}
      <div className="rounded-xl glass-card">
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <h1 className="text-xl font-semibold text-white">{t('usage.summary')}</h1>
        </div>
        {aggregate.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-gray-500">{t('usage.empty')}</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                <th className="px-4 py-3 font-medium">{t('usage.taskKey')}</th>
                <th className="px-4 py-3 font-medium">{t('usage.model')}</th>
                <th className="px-4 py-3 font-medium">
                  <FieldHint label={t('usage.calls')} hint={t('usage.hints.calls')} />
                </th>
                <th className="px-4 py-3 font-medium">
                  <FieldHint label={t('usage.errors')} hint={t('usage.hints.errors')} />
                </th>
                <th className="px-4 py-3 font-medium">
                  <FieldHint label={t('usage.inputTokens')} hint={t('usage.hints.input')} />
                </th>
                <th className="px-4 py-3 font-medium">
                  <FieldHint label={t('usage.outputTokens')} hint={t('usage.hints.output')} />
                </th>
                <th className="px-4 py-3 font-medium">
                  <FieldHint label={t('usage.avgLatency')} hint={t('usage.hints.avgLatency')} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {aggregate.map((r, i) => (
                <tr key={i} className="hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-sm text-blue-400">{r.task_key ?? t('common.none')}</td>
                  <td className="px-4 py-3 text-white">{r.model_name ?? t('common.none')}</td>
                  <td className="px-4 py-3 text-white">{r.calls}</td>
                  <td className="px-4 py-3 text-white">
                    {r.errors > 0 ? <span className="text-red-400">{r.errors}</span> : r.errors}
                  </td>
                  <td className="px-4 py-3 text-white">{r.input_tokens}</td>
                  <td className="px-4 py-3 text-white">{r.output_tokens}</td>
                  <td className="px-4 py-3 text-white">
                    {r.avg_latency_ms != null ? Math.round(r.avg_latency_ms) : t('common.none')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Recent calls ───────────────────────────────────────────────── */}
      <div className="rounded-xl glass-card">
        <div className="border-b border-white/10 p-4">
          <h2 className="text-lg font-semibold text-white">{t('usage.recent')}</h2>
        </div>
        {usage.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-gray-500">{t('usage.empty')}</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                <th className="px-4 py-3 font-medium">{t('usage.time')}</th>
                <th className="px-4 py-3 font-medium">{t('usage.taskKey')}</th>
                <th className="px-4 py-3 font-medium">{t('usage.model')}</th>
                <th className="px-4 py-3 font-medium">
                  <FieldHint label={t('usage.key')} hint={t('usage.hints.key')} />
                </th>
                <th className="px-4 py-3 font-medium">
                  <FieldHint label={t('usage.inputTokens')} hint={t('usage.hints.input')} />
                </th>
                <th className="px-4 py-3 font-medium">
                  <FieldHint label={t('usage.outputTokens')} hint={t('usage.hints.output')} />
                </th>
                <th className="px-4 py-3 font-medium">
                  <FieldHint label={t('usage.latency')} hint={t('usage.hints.latency')} />
                </th>
                <th className="px-4 py-3 font-medium">{t('usage.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {usage.map((u) => (
                <tr key={u.oid} className="hover:bg-white/5">
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {new Date(u.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-blue-400">{u.task_key ?? t('common.none')}</td>
                  <td className="px-4 py-3 text-white">{u.model_name ?? t('common.none')}</td>
                  <td className="px-4 py-3 text-white">{u.key_label ?? t('common.none')}</td>
                  <td className="px-4 py-3 text-white">{u.input_tokens}</td>
                  <td className="px-4 py-3 text-white">{u.output_tokens}</td>
                  <td className="px-4 py-3 text-white">{u.latency_ms ?? t('common.none')}</td>
                  <td className="px-4 py-3 text-sm">
                    {u.status === 'ok' ? (
                      <span className="text-green-400">{u.status}</span>
                    ) : (
                      <span className="text-red-400">{u.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {canWrite && (
        <ClearUsageModal
          isOpen={clearMode !== null}
          mode={clearMode ?? 'filtered'}
          taskKeys={taskKeys}
          models={models}
          isPending={pending}
          error={clearError}
          onCancel={() => {
            if (!pending) {
              setClearMode(null);
              setClearError(null);
            }
          }}
          onConfirm={handleConfirmClear}
        />
      )}
    </div>
  );
}
