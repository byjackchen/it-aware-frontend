'use client';

/** Manage Features: every feature with its phase, its flags and its gates. */

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { featureHref, named } from '@/lib/features/view';
import type { FeaturesResponse } from '@/lib/types/features';
import { tdClass, thClass, When } from '../jobs/parts';
import { PhaseBadge } from './parts';

export function FeaturesList({ data }: { data: FeaturesResponse }) {
  const t = useTranslations('Features.list');
  const locale = useLocale();
  return (
    <div className="overflow-x-auto">
      <table className="w-full" aria-label={t('label')}>
        <thead>
          <tr className="border-b border-line">
            <th className={thClass}>{t('feature')}</th>
            <th className={thClass}>{t('phase')}</th>
            <th className={thClass}>{t('flags')}</th>
            <th className={thClass}>{t('gates')}</th>
            <th className={thClass}>{t('lastEvent')}</th>
          </tr>
        </thead>
        <tbody>
          {data.features.map((f) => (
            <tr key={f.code} className="border-b border-line align-top">
              <td className={tdClass}>
                <Link href={featureHref(f.code)} className="font-medium text-accent hover:underline">
                  {named(f.name, locale)}
                </Link>
                <div className="font-mono text-xs text-muted">{f.code}</div>
              </td>
              <td className={tdClass}>
                <PhaseBadge phase={f.phase} />
              </td>
              <td className={tdClass}>
                {f.flags.length === 0
                  ? '—'
                  : f.flags.map((flag) => (
                      <div key={flag.code} className="font-mono text-xs">
                        {flag.code} = {flag.value ?? t('noValue')}
                      </div>
                    ))}
              </td>
              <td className={tdClass}>{f.gates_total === 0 ? '—' : `${f.gates_passed} / ${f.gates_total}`}</td>
              <td className={tdClass}>
                <When iso={f.last_event_at} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
