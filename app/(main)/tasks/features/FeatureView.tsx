'use client';

/**
 * Manage Features: one feature. Its flags with their values, and every flip (who,
 * when, why); for a person holding `systems:features:edit`, flipping a flag to one
 * of its values, with a reason. That is all it controls: where the change stands in
 * add, switch and remove is written in it-aware-backend docs/feature-lifecycle.md.
 * The backend enforces the rules; a refusal is shown as it says.
 */

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePermissions } from '@/lib/contexts/user-context';
import { FEATURES_EDIT_PERMISSION, named } from '@/lib/features/view';
import { flipFlag } from '@/app/actions/features';
import type { FeatureDetail, FlagState } from '@/lib/types/features';
import { Notice, tdClass, thClass, When } from '../jobs/parts';

const inputClass = 'theme-input rounded-lg border border-line px-2 py-1 text-sm';
const buttonClass = 'rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-accent hover:bg-blue-500/30 disabled:opacity-50';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-2">{title}</h2>
      {children}
    </section>
  );
}

/** The value a flip form starts on: the first value that is not the current one. */
function another(flag: FlagState): string {
  return flag.values.find((v) => v !== flag.value) ?? flag.values[0];
}

export function FeatureView({ feature }: { feature: FeatureDetail }) {
  const t = useTranslations('Features');
  const locale = useLocale();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(FEATURES_EDIT_PERMISSION);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const first = feature.flags[0];
  const [flagCode, setFlagCode] = useState(first?.code ?? '');
  const flag = feature.flags.find((f) => f.code === flagCode);
  const [value, setValue] = useState(first ? another(first) : '');
  const [reason, setReason] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await flipFlag(feature.code, flagCode, value, reason);
      if (result.ok) {
        setOutcome({ tone: 'success', text: t('recorded') });
        setReason('');
        router.refresh();
      } else {
        setOutcome({ tone: 'error', text: result.failure.message });
      }
    });
  };

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold theme-text-primary">{named(feature.name, locale)}</h2>
          <span className="font-mono text-xs text-muted">{feature.code}</span>
        </div>
        <p className="mt-1 text-sm text-ink-2">{named(feature.description, locale)}</p>
        <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted">
          {feature.owner && <span>{t('owner', { owner: feature.owner })}</span>}
          {feature.tapd && (
            <a href={feature.tapd} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              TAPD
            </a>
          )}
        </div>
      </div>

      {outcome && <Notice tone={outcome.tone}>{outcome.text}</Notice>}

      <Section title={t('sections.flags')}>
        <table className="w-full" aria-label={t('sections.flags')}>
          <thead>
            <tr className="border-b border-line">
              <th className={thClass}>{t('flag.name')}</th>
              <th className={thClass}>{t('flag.value')}</th>
              <th className={thClass}>{t('flag.values')}</th>
              <th className={thClass}>{t('flag.changed')}</th>
            </tr>
          </thead>
          <tbody>
            {feature.flags.map((f) => (
              <tr key={f.code} className="border-b border-line">
                <td className={tdClass}>
                  <div>{named(f.name, locale)}</div>
                  <div className="font-mono text-xs text-muted">{f.code}</div>
                </td>
                <td className={`${tdClass} font-mono`}>{f.value ?? t('list.noValue')}</td>
                <td className={`${tdClass} font-mono text-xs`}>{f.values.join(' · ')}</td>
                <td className={`${tdClass} text-xs`}>
                  {f.changed_by} · <When iso={f.changed_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {canEdit && flag && (
          <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={submit}>
            {feature.flags.length > 1 && (
              <select
                className={inputClass}
                value={flagCode}
                onChange={(e) => {
                  setFlagCode(e.target.value);
                  const next = feature.flags.find((f) => f.code === e.target.value);
                  if (next) setValue(another(next));
                }}
                aria-label={t('flag.name')}
              >
                {feature.flags.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.code}
                  </option>
                ))}
              </select>
            )}
            <select className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} aria-label={t('flag.value')}>
              {flag.values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <input className={`${inputClass} min-w-64`} placeholder={t('flag.reason')} value={reason} onChange={(e) => setReason(e.target.value)} />
            <button type="submit" className={buttonClass} disabled={pending || !reason.trim() || value === flag.value}>
              {t('flag.submit')}
            </button>
          </form>
        )}
      </Section>

      <Section title={t('sections.flips')}>
        {feature.flips.length === 0 ? (
          <p className="text-sm text-muted">{t('noFlips')}</p>
        ) : (
          <ol className="space-y-2" aria-label={t('sections.flips')}>
            {feature.flips.map((e) => (
              <li key={e.oid} className="rounded-lg border border-line px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{t('flipped', { flag: e.flag ?? '', value: e.value ?? '' })}</span>
                  <span className="text-xs text-muted">
                    {e.actor} · <When iso={e.at} />
                    {e.release_commit && ` · ${e.release_commit.slice(0, 7)}`}
                  </span>
                </div>
                {e.reason && <div className="text-sm text-ink-2">{e.reason}</div>}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
