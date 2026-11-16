'use client';

/**
 * Manage Features: one feature. Its phase (add, switch, remove), its flags, the
 * gates each phase needs, and its whole history; and, for a person holding
 * `systems:features:edit`, the four changes: flip a flag, record a gate, move the
 * phase, add a note. The backend enforces the rules; a refusal is shown as it says.
 */

import { useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { usePermissions } from '@/lib/contexts/user-context';
import { canFlip, earlierPhases, evidenceFrom, FEATURES_EDIT_PERMISSION, named } from '@/lib/features/view';
import { enterPhase, flipFlag, recordGate, recordNote, type FeaturesResult } from '@/app/actions/features';
import type { FeatureDetail, FeatureEvent, Phase } from '@/lib/types/features';
import { Notice, tdClass, thClass, When } from '../jobs/parts';
import { PhaseBadge, PhaseStrip } from './parts';

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

/** Send one change; show what came of it; reload the feature when it was recorded. */
function useChange() {
  const t = useTranslations('Features');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const send = (work: () => Promise<FeaturesResult>, done?: () => void) =>
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        setOutcome({ tone: 'success', text: t('recorded') });
        done?.();
        router.refresh();
      } else {
        setOutcome({ tone: 'error', text: result.failure.message });
      }
    });
  return { pending, outcome, send };
}

function Evidence({ event }: { event: FeatureEvent }) {
  const e = event.evidence;
  if (!e) return null;
  return (
    <div className="text-xs text-muted">
      {typeof e.link === 'string' && (
        <a href={e.link} target="_blank" rel="noreferrer" className="text-accent hover:underline">
          {e.link}
        </a>
      )}
      {typeof e.text === 'string' && <div className="whitespace-pre-wrap">{e.text}</div>}
      {Object.entries(e)
        .filter(([k]) => k !== 'link' && k !== 'text')
        .map(([k, v]) => (
          <div key={k} className="font-mono">
            {k}: {typeof v === 'string' ? v : JSON.stringify(v)}
          </div>
        ))}
    </div>
  );
}

function describe(event: FeatureEvent, t: ReturnType<typeof useTranslations>): string {
  switch (event.kind) {
    case 'phase':
      return t('events.phase', { phase: t(`phases.${event.phase}`) });
    case 'gate':
      return t(event.passed ? 'events.gatePassed' : 'events.gateFailed', { gate: event.gate ?? '' });
    case 'flag':
      return t('events.flag', { flag: event.flag ?? '', value: event.value ?? '' });
    case 'migration':
      return t('events.migration', { revision: event.value ?? '', phase: t(`phases.${event.phase}`) });
    case 'check':
      return t(event.passed ? 'events.checkPassed' : 'events.checkFailed', { check: event.value ?? '' });
    default:
      return t('events.note');
  }
}

export function FeatureView({ feature }: { feature: FeatureDetail }) {
  const t = useTranslations('Features');
  const locale = useLocale();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(FEATURES_EDIT_PERMISSION);
  const { pending, outcome, send } = useChange();

  // The forms' own state.
  const firstFlag = feature.flags[0];
  const [flagCode, setFlagCode] = useState(firstFlag?.code ?? '');
  const flag = feature.flags.find((f) => f.code === flagCode);
  const [flagValue, setFlagValue] = useState(firstFlag ? (firstFlag.value === firstFlag.new ? firstFlag.old : firstFlag.new) : '');
  const [flagReason, setFlagReason] = useState('');
  const [gate, setGate] = useState(feature.gates[0]?.code ?? '');
  const [gatePassed, setGatePassed] = useState(true);
  const [gateLink, setGateLink] = useState('');
  const [gateText, setGateText] = useState('');
  const moves = [...feature.next_phases.map((p) => p.phase), ...earlierPhases(feature.phase)] as Exclude<Phase, 'planned'>[];
  const [target, setTarget] = useState<Exclude<Phase, 'planned'> | ''>(moves[0] ?? '');
  const [moveReason, setMoveReason] = useState('');
  const [override, setOverride] = useState(false);
  const [note, setNote] = useState('');
  const missing = feature.next_phases.find((p) => p.phase === target)?.missing_gates ?? [];

  const submit = (work: () => Promise<FeaturesResult>, done?: () => void) => (e: FormEvent) => {
    e.preventDefault();
    send(work, done);
  };

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold theme-text-primary">{named(feature.name, locale)}</h2>
          <PhaseBadge phase={feature.phase} />
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

      <Section title={t('sections.phase')}>
        <PhaseStrip phase={feature.phase} />
        <div className="mt-2 text-xs text-muted">
          {(['add', 'switch', 'remove'] as const).map((p) => (
            <div key={p}>
              {t(`phases.${p}`)}: {feature.revisions[p].length ? feature.revisions[p].join(', ') : '—'}
            </div>
          ))}
        </div>
        {canEdit && moves.length > 0 && (
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={submit(
              () => enterPhase(feature.code, target as Exclude<Phase, 'planned'>, moveReason, override),
              () => setMoveReason(''),
            )}
          >
            <label className="text-sm">
              {t('move.to')}{' '}
              <select
                className={inputClass}
                value={target}
                onChange={(e) => setTarget(e.target.value as Exclude<Phase, 'planned'>)}
                aria-label={t('move.to')}
              >
                {moves.map((p) => (
                  <option key={p} value={p}>
                    {t(`phases.${p}`)}
                  </option>
                ))}
              </select>
            </label>
            <input className={`${inputClass} min-w-64`} placeholder={t('reason')} value={moveReason} onChange={(e) => setMoveReason(e.target.value)} />
            {missing.length > 0 && (
              <label className="flex items-center gap-1 text-sm text-warn">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                {t('move.override', { gates: missing.join(', ') })}
              </label>
            )}
            <button type="submit" className={buttonClass} disabled={pending || !target}>
              {t('move.submit')}
            </button>
          </form>
        )}
      </Section>

      <Section title={t('sections.flags')}>
        {feature.flags.length === 0 ? (
          <p className="text-sm text-muted">{t('noFlags')}</p>
        ) : (
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
                  <td className={`${tdClass} text-xs`}>{t('flag.oldNew', { old: f.old, new: f.new })}</td>
                  <td className={`${tdClass} text-xs`}>
                    {f.changed_by} · <When iso={f.changed_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canEdit && flag && (
          canFlip(feature) ? (
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              onSubmit={submit(() => flipFlag(feature.code, flagCode, flagValue, flagReason), () => setFlagReason(''))}
            >
              {feature.flags.length > 1 && (
                <select className={inputClass} value={flagCode} onChange={(e) => setFlagCode(e.target.value)} aria-label={t('flag.name')}>
                  {feature.flags.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.code}
                    </option>
                  ))}
                </select>
              )}
              <select className={inputClass} value={flagValue} onChange={(e) => setFlagValue(e.target.value)} aria-label={t('flag.value')}>
                {flag.values.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
              <input className={`${inputClass} min-w-64`} placeholder={t('flag.reason')} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} />
              <button type="submit" className={buttonClass} disabled={pending || !flagReason.trim()}>
                {t('flag.submit')}
              </button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-muted">{t('flag.onlyInSwitch')}</p>
          )
        )}
      </Section>

      <Section title={t('sections.gates')}>
        {feature.gates.length === 0 ? (
          <p className="text-sm text-muted">{t('noGates')}</p>
        ) : (
          <table className="w-full" aria-label={t('sections.gates')}>
            <thead>
              <tr className="border-b border-line">
                <th className={thClass}>{t('gate.name')}</th>
                <th className={thClass}>{t('gate.before')}</th>
                <th className={thClass}>{t('gate.state')}</th>
                <th className={thClass}>{t('gate.evidence')}</th>
              </tr>
            </thead>
            <tbody>
              {feature.gates.map((g) => (
                <tr key={g.code} className="border-b border-line align-top">
                  <td className={tdClass}>
                    <div>{named(g.name, locale)}</div>
                    <div className="font-mono text-xs text-muted">{g.code}</div>
                  </td>
                  <td className={tdClass}>{t(`phases.${g.before}`)}</td>
                  <td className={tdClass}>
                    <span className={g.passed ? 'text-good' : g.passed === false ? 'text-bad' : 'text-muted'}>
                      {t(g.passed ? 'gate.passed' : g.passed === false ? 'gate.failed' : 'gate.open')}
                    </span>
                    {g.recorded && (
                      <div className="text-xs text-muted">
                        {g.recorded.actor} · <When iso={g.recorded.at} />
                      </div>
                    )}
                  </td>
                  <td className={tdClass}>{g.recorded && <Evidence event={g.recorded} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {feature.checks.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-muted" aria-label={t('checks.label')}>
            {feature.checks.map((c) => (
              <li key={c.code}>{t('checks.item', { check: c.code, job: c.job })}</li>
            ))}
          </ul>
        )}
        {canEdit && feature.gates.length > 0 && (
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={submit(() => recordGate(feature.code, gate, gatePassed, '', evidenceFrom(gateLink, gateText)), () => {
              setGateLink('');
              setGateText('');
            })}
          >
            <select className={inputClass} value={gate} onChange={(e) => setGate(e.target.value)} aria-label={t('gate.name')}>
              {feature.gates.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.code}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={gatePassed} onChange={(e) => setGatePassed(e.target.checked)} />
              {t('gate.passed')}
            </label>
            <input className={inputClass} placeholder={t('gate.link')} value={gateLink} onChange={(e) => setGateLink(e.target.value)} />
            <input className={`${inputClass} min-w-64`} placeholder={t('gate.text')} value={gateText} onChange={(e) => setGateText(e.target.value)} />
            <button type="submit" className={buttonClass} disabled={pending || !(gateLink.trim() || gateText.trim())}>
              {t('gate.submit')}
            </button>
          </form>
        )}
      </Section>

      <Section title={t('sections.history')}>
        {canEdit && (
          <form className="mb-3 flex flex-wrap items-end gap-2" onSubmit={submit(() => recordNote(feature.code, note, {}), () => setNote(''))}>
            <input className={`${inputClass} min-w-96`} placeholder={t('note.placeholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="submit" className={buttonClass} disabled={pending || !note.trim()}>
              {t('note.submit')}
            </button>
          </form>
        )}
        {feature.events.length === 0 ? (
          <p className="text-sm text-muted">{t('noEvents')}</p>
        ) : (
          <ol className="space-y-2" aria-label={t('sections.history')}>
            {feature.events.map((e) => (
              <li key={e.oid} className="rounded-lg border border-line px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{describe(e, t)}</span>
                  <span className="text-xs text-muted">
                    {e.actor} · <When iso={e.at} />
                    {e.release_commit && ` · ${e.release_commit.slice(0, 7)}`}
                    {e.release_head && ` @ ${e.release_head}`}
                  </span>
                </div>
                {e.reason && <div className="text-sm text-ink-2">{e.reason}</div>}
                <Evidence event={e} />
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
