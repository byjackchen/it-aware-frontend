'use client';

/** Manage Features: every feature with its flags and their values. */

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { featureHref, named } from '@/lib/features/view';
import type { FeaturesResponse } from '@/lib/types/features';
import { tdClass, thClass, When } from '../jobs/parts';

export function FeaturesList({ data }: { data: FeaturesResponse }) {
  const t = useTranslations('Features.list');
  const locale = useLocale();
  if (data.features.length === 0) {
    return <p className="py-8 text-center text-muted" data-testid="features-empty">{t('empty')}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full" aria-label={t('label')}>
        <thead>
          <tr className="border-b border-line">
            <th className={thClass}>{t('feature')}</th>
            <th className={thClass}>{t('flags')}</th>
            <th className={thClass}>{t('lastFlip')}</th>
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
                {f.flags.map((flag) => (
                  <div key={flag.code} className="font-mono text-xs">
                    {flag.code} = {flag.value ?? t('noValue')}
                  </div>
                ))}
              </td>
              <td className={tdClass}>{f.last_flip_at ? <When iso={f.last_flip_at} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
