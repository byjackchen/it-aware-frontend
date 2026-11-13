/**
 * Data Overview: IT-Aware's tables in the three layers of the target data
 * model, in flow order (GET /data/layers). Each layer is a card: what it is,
 * who writes it, its totals, a note computed from the data, and its tables
 * grouped by subject with a row count each.
 */

import Link from 'next/link';
import { useLocale, useNow, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { countedAgo, shapeLayers, type LayerNote, type TagKey } from '@/lib/data-layers/view';
import type { DataLayers, LayerCode } from '@/lib/types/data-layers';
import type { Task } from '@/lib/types/tasks';

/** A layer's colour: the bar over its card and its numbered badge. */
const LAYER_COLOR: Record<LayerCode, string> = {
  raw: 'bg-muted',
  derived: 'bg-accent',
  transactional: 'bg-good',
};

const TAG_CLASS: Record<TagKey, string> = {
  source_copy: 'bg-accent-soft text-accent',
  computed: 'bg-good/15 text-good',
  mixed: 'bg-mark text-ink',
  landing: 'bg-field text-ink-2',
  raw: 'bg-field text-ink-2',
};

function Tag({ tag }: { tag: TagKey }) {
  const t = useTranslations('Dashboard.layers.tags');
  return (
    <span data-testid="layer-tag" className={`ml-1.5 whitespace-nowrap rounded-lg px-1.5 py-px text-[11px] ${TAG_CLASS[tag]}`}>
      {t(tag)}
    </span>
  );
}

function Note({ note }: { note: LayerNote }) {
  const t = useTranslations('Dashboard.layers.notes');
  return (
    <p data-testid="layer-note" className="mx-4 mt-3 rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
      {note.kind === 'unused'
        ? t('unused')
        : t.rich(note.kind, { count: note.count, tag: () => <Tag tag="mixed" /> })}
    </p>
  );
}

interface LayerColumnsProps {
  data: DataLayers;
  /** The person's tasks; null when the backend did not answer them. */
  held: Task[] | null;
}

export function LayerColumns({ data, held }: LayerColumnsProps) {
  const t = useTranslations('Dashboard.layers');
  const locale = useLocale();
  const layers = shapeLayers(data, {
    held,
    locale,
    subject: (schema) => (t.has(`subjects.${schema}`) ? t(`subjects.${schema}`) : schema),
  });
  // The time of this request, the same wherever the page asks for it.
  const counted = countedAgo(data.counted_at, useNow().getTime(), locale);
  return (
    <section className="space-y-3" data-testid="data-layers">
      <p className="text-center text-xs text-muted" data-testid="data-layers-flow">
        {t.rich('flow', { b: (chunks) => <b className="font-semibold text-ink-2">{chunks}</b> })}
      </p>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.25fr_1fr]">
        {layers.map((layer) => (
          <section key={layer.layer} className="glass-card overflow-hidden rounded-xl" data-testid={`data-layer-${layer.layer}`}>
            <div className={`h-1 ${LAYER_COLOR[layer.layer]}`} />
            <header className="flex gap-3 px-4 pb-1.5 pt-3.5">
              <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-sm font-bold text-page ${LAYER_COLOR[layer.layer]}`}>
                {layer.step}
              </span>
              <div>
                <h2 className="text-base font-semibold text-ink">{t(`names.${layer.layer}`)}</h2>
                <p className="mt-0.5 text-[13px] text-ink-2">{t(`descriptions.${layer.layer}`)}</p>
                <p className="mt-0.5 text-xs text-muted">{t(`writtenBy.${layer.layer}`)}</p>
              </div>
            </header>
            <dl className="mt-2 flex gap-6 border-y border-line px-4 py-2.5">
              <div>
                <dd className="text-xl font-semibold tabular-nums text-ink" data-testid="layer-tables">{layer.tables}</dd>
                <dt className="text-xs text-muted">{t('totals.tables')}</dt>
              </div>
              <div>
                <dd className="text-xl font-semibold tabular-nums text-ink" data-testid="layer-rows">{layer.rows}</dd>
                <dt className="text-xs text-muted">{t(layer.approximate ? 'totals.rowsApproximate' : 'totals.rows')}</dt>
              </div>
            </dl>
            {layer.note && <Note note={layer.note} />}
            <div className="px-4 pb-3.5 pt-1.5">
              {layer.groups.map((group) => (
                <div key={group.schema} data-testid={`layer-group-${group.schema}`}>
                  <h3 className="mb-0.5 mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{group.subject}</h3>
                  <ul>
                    {group.tables.map((row) => (
                      <li key={row.table} data-testid="layer-table" data-table={row.table} className="flex justify-between gap-2.5 border-t border-line py-1.5">
                        <div className="min-w-0">
                          <code className="break-all font-mono text-xs text-ink">{row.table}</code>
                          {row.tag && <Tag tag={row.tag} />}
                          {row.link && (
                            <Link href={row.link.href} className="mt-px block text-xs text-accent hover:underline">
                              → {row.link.name}
                            </Link>
                          )}
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-ink" data-testid="layer-table-rows">{row.rows}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {counted && (
        <p className="text-xs text-muted" data-testid="data-layers-counted">{t('counted', { time: counted })}</p>
      )}
    </section>
  );
}

/** The layers could not be read: said in place of the columns, with the backend's own message. */
export function LayersFailure({ message }: { message: string }) {
  const t = useTranslations('Dashboard.layers');
  return (
    <div role="alert" data-testid="data-layers-failed" className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad/10 px-4 py-3 text-sm text-bad">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{t('loadFailed', { message })}</div>
    </div>
  );
}
