import { expect, it } from 'vitest';
import {
  appendLog,
  filterJobs,
  formatDuration,
  hasFailedSteps,
  isUnavailable,
  isUnfinished,
  logTries,
  parameterFields,
  parameterValues,
  stateTone,
} from '@/lib/jobs/view';
import type { Job, JobParameter, Step } from '@/lib/types/jobs';

function job(over: Partial<Job>): Job {
  return {
    id: 'j', name: 'j', description: null, schedule: null, next_run: null, paused: false,
    has_load_errors: false, tags: [], last_run: null, manual_run_allowed: true, manual_run_refusal: null,
    retry_failed_allowed: true, retry_failed_refusal: null, ...over,
  };
}

const run = (state: string | null) => ({
  id: 'r', state, run_type: null, run_after: null, start: null, end: null, duration_s: null,
});

const step = (state: string | null, try_number = 1): Step => ({
  id: 's', name: 's', map_index: -1, state, start: null, end: null, duration_s: null, try_number,
});

it('groups Airflow states into tones', () => {
  expect(stateTone('success')).toBe('success');
  expect(stateTone('failed')).toBe('failed');
  expect(stateTone('upstream_failed')).toBe('failed');
  expect(stateTone('running')).toBe('running');
  expect(stateTone('restarting')).toBe('running');
  for (const s of ['queued', 'scheduled', 'up_for_retry', 'up_for_reschedule', 'deferred']) {
    expect(stateTone(s)).toBe('waiting');
  }
  expect(stateTone('skipped')).toBe('none');
  expect(stateTone(null)).toBe('none');
});

it('knows an unfinished run and a run with failed steps', () => {
  expect(isUnfinished(run('running'))).toBe(true);
  expect(isUnfinished(run('queued'))).toBe(true);
  expect(isUnfinished(run('success'))).toBe(false);
  expect(hasFailedSteps(run('failed'), [])).toBe(true);
  expect(hasFailedSteps(run('running'), [step('failed')])).toBe(true);
  expect(hasFailedSteps(run('success'), [step('success')])).toBe(false);
});

it('offers a log for each try a step has had', () => {
  expect(logTries(step('failed', 2))).toEqual([1, 2]);
  expect(logTries(step(null, 0))).toEqual([]);
});

it('formats durations', () => {
  expect(formatDuration(null)).toBeNull();
  expect(formatDuration(47.4)).toBe('47s');
  expect(formatDuration(247.1)).toBe('4m 7s');
  expect(formatDuration(7500)).toBe('2h 5m');
});

it('filters jobs by text and state', () => {
  const jobs = [
    job({ id: 'digest', tags: ['llm'], last_run: run('success') }),
    job({ id: 'sync', description: 'Import from ERP', paused: true, has_load_errors: true }),
    job({ id: 'notify', last_run: run('failed') }),
    job({ id: 'live', last_run: run('running') }),
  ];
  const ids = (list: Job[]) => list.map((j) => j.id);
  expect(ids(filterJobs(jobs, '', 'all'))).toEqual(['digest', 'sync', 'notify', 'live']);
  expect(ids(filterJobs(jobs, ' LLM ', 'all'))).toEqual(['digest']);
  expect(ids(filterJobs(jobs, 'erp', 'all'))).toEqual(['sync']);
  expect(ids(filterJobs(jobs, '', 'active'))).toEqual(['digest', 'notify', 'live']);
  expect(ids(filterJobs(jobs, '', 'paused'))).toEqual(['sync']);
  expect(ids(filterJobs(jobs, '', 'running'))).toEqual(['live']);
  expect(ids(filterJobs(jobs, '', 'failed'))).toEqual(['notify']);
  expect(ids(filterJobs(jobs, '', 'load_errors'))).toEqual(['sync']);
  expect(ids(filterJobs(jobs, 'digest', 'paused'))).toEqual([]);
});

const param = (name: string, schema: Record<string, unknown>, def: unknown = null): JobParameter => ({
  name, default: def, description: null, schema,
});

it('builds the run-now form from the job parameters', () => {
  const fields = parameterFields([
    param('window_hours', { type: 'integer' }, 2),
    param('ratio', { type: ['null', 'number'] }),
    param('dry_run', { type: 'boolean' }, true),
    param('flag', { type: 'boolean' }),
    param('note', { type: 'string' }, 'hi'),
    param('label', {}, 'x'),
    param('ids', { type: 'array' }, [1, 2]),
    param('anything', {}),
    param('nulls', { type: ['null'] }),
  ]);
  expect(fields.map((f) => [f.name, f.kind, f.initial])).toEqual([
    ['window_hours', 'integer', '2'],
    ['ratio', 'number', ''],
    ['dry_run', 'boolean', true],
    ['flag', 'boolean', false],
    ['note', 'string', 'hi'],
    ['label', 'string', 'x'],
    ['ids', 'json', '[1,2]'],
    ['anything', 'json', ''],
    ['nulls', 'json', ''],
  ]);
});

it('reads the form back into the parameters to send', () => {
  const fields = parameterFields([
    param('window_hours', { type: 'integer' }, 2),
    param('ratio', { type: 'number' }),
    param('dry_run', { type: 'boolean' }, true),
    param('note', { type: 'string' }, ''),
    param('ids', { type: 'array' }),
  ]);
  // Defaults left as they are are not sent: Airflow applies them (since the
  // backend masks secret-looking defaults, review 2026-11-12).
  expect(parameterValues(fields, {})).toEqual({ ok: true, values: {} });
  expect(parameterValues(fields, { window_hours: '2', dry_run: true })).toEqual({ ok: true, values: {} });
  expect(parameterValues(fields, { window_hours: '3', ratio: '0.5', dry_run: false, note: 'n', ids: '[1]' })).toEqual({
    ok: true, values: { window_hours: 3, ratio: 0.5, dry_run: false, note: 'n', ids: [1] },
  });
  expect(parameterValues(fields, { window_hours: '1.5', ratio: 'abc', ids: '[' })).toEqual({
    ok: false, invalid: ['window_hours', 'ratio', 'ids'],
  });
});

it('tells an action Airflow refuses from one that failed', () => {
  expect(isUnavailable({ code: 'airflow_refused' })).toBe(true);
  expect(isUnavailable({ code: 'conflict' })).toBe(false);
  expect(isUnavailable({ code: null })).toBe(false);
});

it('adds the next part of a log to what was read', () => {
  expect(appendLog({ content: 'a\n', truncated: false }, { content: 'b\n', truncated: false, next_token: 't' })).toEqual({
    content: 'a\nb\n', truncated: false, next_token: 't',
  });
  expect(appendLog({ content: '', truncated: true }, { content: 'x', truncated: false, next_token: null }).truncated).toBe(true);
});

it('leaves out an empty string field with no default, and sends one that clears a default', () => {
  const fields = parameterFields([
    param('notification_batch_oid', { type: 'string' }, ''),
    param('note', { type: 'string' }),
    param('label', { type: 'string' }, 'x'),
  ]);
  expect(parameterValues(fields, {})).toEqual({ ok: true, values: {} }); // label keeps its default in Airflow
  expect(parameterValues(fields, { label: '' })).toEqual({ ok: true, values: { label: '' } });
  expect(parameterValues(fields, { note: 'n', notification_batch_oid: 'b' })).toEqual({
    ok: true, values: { notification_batch_oid: 'b', note: 'n' },
  });
});

it('never sends a masked default back, and sends a value typed over it', () => {
  const fields = parameterFields([
    param('api_key', { type: 'string' }, '***'),
    param('dsn', { type: 'string' }, 'redis://u:***@cache:6379'),
    param('flag', { type: 'boolean' }),
  ]);
  expect(fields.map((f) => f.hasDefault)).toEqual([true, true, false]);
  // A checkbox with no default is still sent as shown: there is no default to fall back on.
  expect(parameterValues(fields, {})).toEqual({ ok: true, values: { flag: false } });
  expect(parameterValues(fields, { api_key: 'new-key', flag: true })).toEqual({
    ok: true, values: { api_key: 'new-key', flag: true },
  });
});
