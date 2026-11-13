/**
 * Data Overview by layer: how the backend's answer (GET /data/layers) is shown —
 * a table's tag, its row count, the task link a holder gets, each layer's note,
 * and when the rows were counted.
 */

import { named, pageHref } from '@/lib/tasks/catalog';
import type { DataLayers, Declared, LayerCode } from '@/lib/types/data-layers';
import type { Task } from '@/lib/types/tasks';

/** The layers in flow order. */
export const LAYER_ORDER: LayerCode[] = ['raw', 'derived', 'transactional'];

/** A tag says where today's table does not match the target yet; a transactional table has none. */
export type TagKey = Exclude<Declared, 'transactional'>;

const TAGS: readonly string[] = ['landing', 'raw', 'source_copy', 'computed', 'mixed'] satisfies TagKey[];

/** The tag of a table declared as `declared`; null for a transactional table, or a declaration this page does not know. */
export function tagOf(declared: string): TagKey | null {
  return TAGS.includes(declared) ? (declared as TagKey) : null;
}

/** A row count with thousands separators: "≈" before an estimate, "—" for a table that is missing. */
export function formatRows(rows: number | null, approximate: boolean, locale: string): string {
  if (rows === null) return '—';
  return `${approximate ? '≈' : ''}${rows.toLocaleString(locale)}`;
}

export interface TaskLink {
  name: string;
  href: string;
}

/** The link to the task `code`, when the person holds it: its name in their language and the address of their first view of it. */
export function taskLink(code: string | null, held: Task[] | null, locale: string): TaskLink | null {
  const task = code === null ? undefined : held?.find((candidate) => candidate.code === code);
  return task ? { name: named(task.name, locale), href: pageHref(task.address) } : null;
}

/**
 * What a layer's note box says, from the data:
 * - raw, `unused`: the tables declared raw hold no row yet (`declared_rows.raw` is 0);
 * - derived, `toSplit`: `count` tables hold source data together with people's marks;
 * - transactional, `toArrive`: the marks of those `count` tables are still to arrive.
 */
export type LayerNote = { kind: 'unused' } | { kind: 'toSplit' | 'toArrive'; count: number };

export interface TableView {
  table: string;
  tag: TagKey | null;
  rows: string;
  link: TaskLink | null;
}

export interface LayerView {
  layer: LayerCode;
  /** Its place in the flow, from 1. */
  step: number;
  tables: string;
  /**
   * Its headline rows, with "≈" when the layer's total is an estimate. For raw,
   * the rows of the tables declared raw only: the older landing area is apart.
   */
  rows: string;
  approximate: boolean;
  /** Raw only: the rows of the older landing area; null for a layer without one. */
  landing: string | null;
  /** How many of its tables the person is not shown; 0 for an administrator. */
  hidden: number;
  note: LayerNote | null;
  groups: { schema: string; subject: string; tables: TableView[] }[];
}

interface ShapeOptions {
  /** The person's tasks; null when the backend did not answer them (no table is linked then). */
  held: Task[] | null;
  locale: string;
  /** A schema's subject name in the person's language. */
  subject: (schema: string) => string;
}

/** The three layers in flow order, each with its note and its tables grouped by subject, the subjects by name. */
export function shapeLayers(data: DataLayers, { held, locale, subject }: ShapeOptions): LayerView[] {
  // No table to split is in a schema kept from anyone, so the tables listed have them all.
  const all = data.layers.flatMap((layer) => layer.groups.flatMap((group) => group.tables));
  const toSplit = all.filter((table) => table.declared === 'mixed').length;

  return LAYER_ORDER.flatMap((code, index) =>
    data.layers
      .filter((layer) => layer.layer === code)
      .map((layer) => {
        // The totals are whole for everyone; the raw note reads them, not the tables listed.
        const declared = layer.declared_rows;
        const note: LayerNote | null =
          code === 'raw'
            ? declared.raw === 0 ? { kind: 'unused' } : null
            : toSplit > 0 ? { kind: code === 'derived' ? 'toSplit' : 'toArrive', count: toSplit } : null;
        return {
          layer: code,
          step: index + 1,
          tables: layer.tables.toLocaleString(locale),
          rows: formatRows(code === 'raw' ? declared.raw ?? 0 : layer.rows, layer.approximate, locale),
          approximate: layer.approximate,
          landing: declared.landing === undefined ? null : declared.landing.toLocaleString(locale),
          hidden: layer.hidden_tables,
          note,
          groups: layer.groups
            .map((group) => ({
              schema: group.schema,
              subject: subject(group.schema),
              tables: group.tables.map((table) => ({
                table: table.table,
                tag: tagOf(table.declared),
                rows: formatRows(table.rows, table.approximate, locale),
                link: taskLink(table.task, held, locale),
              })),
            }))
            .sort((a, b) => a.subject.localeCompare(b.subject, locale)),
        };
      }),
  );
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long before `now` (epoch ms) the rows were counted, in the person's language; null for a time that is none. */
export function countedAgo(iso: string, now: number, locale: string): string | null {
  const counted = new Date(iso).getTime();
  if (Number.isNaN(counted)) return null;
  const seconds = Math.max(0, Math.floor((now - counted) / 1000));
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (seconds < MINUTE) return relative.format(0, 'second');
  if (seconds < HOUR) return relative.format(-Math.floor(seconds / MINUTE), 'minute');
  if (seconds < DAY) return relative.format(-Math.floor(seconds / HOUR), 'hour');
  return relative.format(-Math.floor(seconds / DAY), 'day');
}
