'use client';

import { useTranslations } from 'next-intl';
import { BarChart3 } from 'lucide-react';
import type { LLMUsage, LLMUsageAggregateRow } from '@/lib/types/systems';
import { FieldHint } from './FieldHint';

interface Props {
  usage: LLMUsage[];
  aggregate: LLMUsageAggregateRow[];
}

export function UsageClient({ usage, aggregate }: Props) {
  const t = useTranslations('Systems');

  return (
    <div className="h-[calc(100vh-4rem)] space-y-4 overflow-auto p-4">
      <div className="rounded-xl glass-card">
        <div className="flex items-center gap-3 border-b border-white/10 p-4">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <h1 className="text-xl font-semibold text-white">{t('usage.summary')}</h1>
          <span className="ml-2 rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400">
            {t('usage.window')}
          </span>
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
                  <FieldHint label={t('usage.cachedTokens')} hint={t('usage.hints.cached')} />
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
                  <td className="px-4 py-3 text-white">{r.cached_tokens}</td>
                  <td className="px-4 py-3 text-white">
                    {r.avg_latency_ms != null ? Math.round(r.avg_latency_ms) : t('common.none')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
                  <FieldHint label={t('usage.cachedTokens')} hint={t('usage.hints.cached')} />
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
                  <td className="px-4 py-3 text-white">{u.cached_tokens}</td>
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
    </div>
  );
}
