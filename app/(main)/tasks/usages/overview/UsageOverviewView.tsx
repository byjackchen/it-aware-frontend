'use client';

import { useTranslations } from 'next-intl';
import { Activity } from 'lucide-react';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard';
import type { UsageOverview } from '@/lib/types/usage';

/** The stat tiles, the daily chart, and since when usage is recorded. */
export function UsageOverviewView({ data }: { data: UsageOverview }) {
  const t = useTranslations('Usage.overview');
  const tiles = [
    { key: 'activeToday', label: t('activeToday'), value: data.active_people.today },
    { key: 'activeLast7', label: t('activeLast7'), value: data.active_people.last_7_days },
    { key: 'activeWindow', label: t('activeWindow', { days: data.days }), value: data.active_people.window },
    { key: 'signIns', label: t('signIns'), value: data.sign_ins },
    { key: 'taskOpens', label: t('taskOpens'), value: data.task_opens },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.key} data-testid={`usage-stat-${tile.key}`}>
            <KpiCard label={tile.label} value={tile.value} className="h-full" />
          </div>
        ))}
      </div>

      {data.tracking_since === null ? (
        <div className="flex h-48 flex-col items-center justify-center text-center text-muted" data-testid="usage-empty">
          <Activity className="mb-3 h-10 w-10 opacity-50" />
          <p className="font-medium text-ink-2">{t('empty.title')}</p>
          <p className="text-sm">{t('empty.body')}</p>
        </div>
      ) : (
        <>
          <div className="mt-4" data-testid="usage-daily-chart">
            <TrendLineCard
              title={t('chart.title')}
              subtitle={t('chart.subtitle')}
              height={260}
              data={data.daily.map((day) => ({ bucket: day.date, active_people: day.active_people, task_opens: day.task_opens }))}
              series={[
                { key: 'active_people', label: t('chart.people'), color: '#3b82f6' },
                { key: 'task_opens', label: t('chart.opens'), color: '#10b981' },
              ]}
            />
          </div>
          <p className="mt-3 text-sm text-ink-2" data-testid="usage-tracking-since">
            {t('trackingSince', { date: data.tracking_since })}{' '}
            <span className="text-muted">{t('trackingHelp')}</span>
          </p>
        </>
      )}
    </>
  );
}
