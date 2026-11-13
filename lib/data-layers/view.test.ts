import { expect, it } from 'vitest';
import { countedAgo, formatRows, shapeLayers, tagOf, taskLink } from '@/lib/data-layers/view';
import type { DataLayers, Declared, LayerTable } from '@/lib/types/data-layers';
import type { Task } from '@/lib/types/tasks';

/** How Data Overview shows the layers (lib/data-layers/view.ts). */

function table(name: string, declared: Declared, rows: number | null, more: Partial<LayerTable> = {}): LayerTable {
  return { table: name, declared, rows, approximate: false, task: null, ...more };
}

function task(code: string, en: string, zh: string, address: string): Task {
  return { code, name: { en, zh }, grouping: 'data', kind: 'internal', external_app: null, address, keywords: [], views: [] };
}

const HELD = [task('it-incidents', 'View IT Incidents', '查看 IT 事件', '/tasks/it-incidents')];

/** Answered out of flow order, to show the page orders the layers itself. */
const LAYERS: DataLayers = {
  counted_at: '2026-11-12T10:00:00Z',
  layers: [
    {
      layer: 'transactional',
      tables: 1,
      rows: 46,
      approximate: false,
      groups: [{ schema: 'auth', tables: [table('auth.accounts', 'transactional', 46, { task: 'access' })] }],
    },
    {
      layer: 'raw',
      tables: 2,
      rows: 8187,
      approximate: false,
      groups: [
        { schema: 'staging', tables: [table('staging.workers', 'landing', 8187)] },
        { schema: 'raw', tables: [table('raw.records', 'raw', 0)] },
      ],
    },
    {
      layer: 'derived',
      tables: 5,
      rows: 1234567,
      approximate: true,
      groups: [
        { schema: 'objects', tables: [table('objects.workers', 'mixed', 4052), table('objects.gone', 'computed', null)] },
        {
          schema: 'activities',
          tables: [
            table('activities.incidents', 'mixed', 19941, { approximate: true, task: 'it-incidents' }),
            table('activities.incident_slas', 'source_copy', 30092),
          ],
        },
        { schema: 'unknown_schema', tables: [table('unknown_schema.things', 'computed', 3)] },
      ],
    },
  ],
};

const SUBJECTS: Record<string, string> = {
  staging: 'Older landing area',
  raw: 'Raw records',
  objects: 'Workers, hardware, systems',
  activities: 'Tickets and interactions',
  auth: 'Accounts and access',
};
const subject = (schema: string) => SUBJECTS[schema] ?? schema;

it('tags a table by what it is declared as, and a transactional or unknown one not at all', () => {
  expect(['landing', 'raw', 'source_copy', 'computed', 'mixed'].map(tagOf)).toEqual([
    'landing', 'raw', 'source_copy', 'computed', 'mixed',
  ]);
  expect(tagOf('transactional')).toBeNull();
  expect(tagOf('something-new')).toBeNull();
});

it('writes a row count with separators, an estimate with ≈, a missing table as a dash', () => {
  expect(formatRows(8187, false, 'en')).toBe('8,187');
  expect(formatRows(194621, true, 'en')).toBe('≈194,621');
  expect(formatRows(0, false, 'zh')).toBe('0');
  expect(formatRows(null, false, 'en')).toBe('—');
  expect(formatRows(null, true, 'en')).toBe('—');
});

it('links a table to its task only when the person holds the task', () => {
  expect(taskLink('it-incidents', HELD, 'en')).toEqual({ name: 'View IT Incidents', href: '/tasks/it-incidents' });
  expect(taskLink('it-incidents', HELD, 'zh')).toEqual({ name: '查看 IT 事件', href: '/tasks/it-incidents' });
  expect(taskLink('access', HELD, 'en')).toBeNull();
  expect(taskLink(null, HELD, 'en')).toBeNull();
  // The backend did not answer the person's tasks: nothing is linked.
  expect(taskLink('it-incidents', null, 'en')).toBeNull();
});

it('shows the three layers in flow order, with their totals', () => {
  const shaped = shapeLayers(LAYERS, { held: HELD, locale: 'en', subject });
  expect(shaped.map(({ layer, step, tables, rows, approximate }) => ({ layer, step, tables, rows, approximate }))).toEqual([
    { layer: 'raw', step: 1, tables: '2', rows: '8,187', approximate: false },
    { layer: 'derived', step: 2, tables: '5', rows: '≈1,234,567', approximate: true },
    { layer: 'transactional', step: 3, tables: '1', rows: '46', approximate: false },
  ]);
});

it('groups a layer’s tables by subject, the subjects by name, an unknown schema under its own', () => {
  const [raw, derived, transactional] = shapeLayers(LAYERS, { held: HELD, locale: 'en', subject });
  expect(raw.groups.map((group) => group.subject)).toEqual(['Older landing area', 'Raw records']);
  expect(derived.groups.map((group) => group.subject)).toEqual([
    'Tickets and interactions', 'unknown_schema', 'Workers, hardware, systems',
  ]);
  expect(derived.groups[0]).toEqual({
    schema: 'activities',
    subject: 'Tickets and interactions',
    tables: [
      { table: 'activities.incidents', tag: 'mixed', rows: '≈19,941', link: { name: 'View IT Incidents', href: '/tasks/it-incidents' } },
      { table: 'activities.incident_slas', tag: 'source_copy', rows: '30,092', link: null },
    ],
  });
  expect(derived.groups[2].tables[1]).toEqual({ table: 'objects.gone', tag: 'computed', rows: '—', link: null });
  // A transactional table has no tag; its task is not the person's, so no link.
  expect(transactional.groups[0].tables).toEqual([{ table: 'auth.accounts', tag: null, rows: '46', link: null }]);
});

it('notes what the data says: raw not in use, and how many tables are to split', () => {
  const notes = (data: DataLayers) => shapeLayers(data, { held: null, locale: 'en', subject }).map((layer) => layer.note);
  expect(notes(LAYERS)).toEqual([{ kind: 'unused' }, { kind: 'toSplit', count: 2 }, { kind: 'toArrive', count: 2 }]);

  // Raw holds rows, and nothing is marked to split: no notes.
  const settled: DataLayers = {
    counted_at: LAYERS.counted_at,
    layers: [
      { layer: 'raw', tables: 1, rows: 5, approximate: false, groups: [{ schema: 'raw', tables: [table('raw.records', 'raw', 5)] }] },
      { layer: 'derived', tables: 1, rows: 1, approximate: false, groups: [{ schema: 'metrics', tables: [table('metrics.metric_values', 'computed', 1)] }] },
      { layer: 'transactional', tables: 0, rows: 0, approximate: false, groups: [] },
    ],
  };
  expect(notes(settled)).toEqual([null, null, null]);

  // A raw table that is missing holds no row either; a raw layer with no raw table says nothing.
  const missing: DataLayers = { ...settled, layers: [{ ...settled.layers[0], groups: [{ schema: 'raw', tables: [table('raw.records', 'raw', null)] }] }] };
  expect(notes(missing)).toEqual([{ kind: 'unused' }]);
  const landingOnly: DataLayers = { ...settled, layers: [{ ...settled.layers[0], groups: [{ schema: 'staging', tables: [table('staging.workers', 'landing', 0)] }] }] };
  expect(notes(landingOnly)).toEqual([null]);
});

it('says how long ago the rows were counted', () => {
  const at = (iso: string) => new Date(iso).getTime();
  const counted = '2026-11-12T10:00:00Z';
  expect(countedAgo(counted, at('2026-11-12T10:00:20Z'), 'en')).toBe('now');
  expect(countedAgo(counted, at('2026-11-12T10:05:59Z'), 'en')).toBe('5 minutes ago');
  expect(countedAgo(counted, at('2026-11-12T13:00:00Z'), 'en')).toBe('3 hours ago');
  expect(countedAgo(counted, at('2026-11-13T10:00:00Z'), 'en')).toBe('yesterday');
  expect(countedAgo(counted, at('2026-11-15T10:00:00Z'), 'en')).toBe('3 days ago');
  expect(countedAgo(counted, at('2026-11-12T10:05:00Z'), 'zh')).toBe('5分钟前');
  // A clock behind the backend's does not count into the future.
  expect(countedAgo(counted, at('2026-11-12T09:59:00Z'), 'en')).toBe('now');
  expect(countedAgo('not a time', at(counted), 'en')).toBeNull();
});
