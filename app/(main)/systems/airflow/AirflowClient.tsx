'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Workflow, RefreshCw, AlertTriangle, Pause } from 'lucide-react';
import type { AirflowDagsResponse } from '@/lib/types/systems';

interface Props {
  data: AirflowDagsResponse;
}

/** Tailwind color for a DAG-run state. */
function stateColor(state: string | null): string {
  switch (state) {
    case 'success':
      return 'text-green-400';
    case 'failed':
      return 'text-red-400';
    case 'running':
      return 'text-blue-400';
    case 'queued':
    case 'up_for_retry':
    case 'up_for_reschedule':
      return 'text-amber-400';
    default:
      return 'text-gray-500';
  }
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function AirflowClient({ data }: Props) {
  const t = useTranslations('Systems');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="h-[calc(100vh-4rem)] p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-xl glass-card">
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Workflow className="h-5 w-5 text-blue-400" />
            <div>
              <h1 className="text-xl font-semibold text-white">{t('airflow.title')}</h1>
              <p className="text-xs text-gray-500">{t('airflow.help')}</p>
            </div>
          </div>
          <button
            onClick={refresh}
            disabled={pending}
            className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-4 py-2 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">{t('airflow.refresh')}</span>
          </button>
        </div>

        {!data.available ? (
          <div className="m-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {data.base_url_configured
                ? t('airflow.unavailable')
                : t('airflow.notConfigured')}
            </span>
          </div>
        ) : data.dags.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-gray-500">
            <Workflow className="mb-4 h-12 w-12 opacity-50" />
            <p>{t('airflow.empty')}</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-inherit">
                <tr className="border-b border-white/10 text-left text-sm text-gray-400">
                  <th className="px-4 py-3 font-medium">{t('airflow.dag')}</th>
                  <th className="px-4 py-3 font-medium">{t('airflow.status')}</th>
                  <th className="px-4 py-3 font-medium">{t('airflow.schedule')}</th>
                  <th className="px-4 py-3 font-medium">{t('airflow.lastRun')}</th>
                  <th className="px-4 py-3 font-medium">{t('airflow.lastRunTime')}</th>
                  <th className="px-4 py-3 font-medium">{t('airflow.duration')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.dags.map((d) => (
                  <tr key={d.dag_id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-sm text-blue-400">{d.dag_id}</span>
                        {d.has_import_errors && (
                          <span title={t('airflow.importError')} className="text-red-400">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {d.is_paused ? (
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <Pause className="h-3.5 w-3.5" />
                          {t('airflow.paused')}
                        </span>
                      ) : (
                        <span className="text-green-400">{t('airflow.active')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{d.schedule ?? '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={stateColor(d.last_run_state)}>
                        {d.last_run_state ?? t('airflow.noRun')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatTime(d.last_run_start ?? d.last_run_end)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatDuration(d.last_run_duration_s)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
