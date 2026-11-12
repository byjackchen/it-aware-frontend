import { expect, it } from 'vitest';
import { JOBS_BASE, jobsHref, parseJobsView } from '@/lib/jobs/paths';

const RUN = 'scheduled__2026-06-01T00:00:00+00:00';

it('links every screen from the one base address, with ids encoded', () => {
  expect(jobsHref()).toBe(JOBS_BASE);
  expect(jobsHref({ tab: 'actions' })).toBe(`${JOBS_BASE}?tab=actions`);
  expect(jobsHref({ tab: 'actions', job: 'gate_digest', page: 2 })).toBe(`${JOBS_BASE}?tab=actions&job=gate_digest&page=2`);
  expect(jobsHref({ job: 'gate_digest', page: 1 })).toBe(`${JOBS_BASE}?job=gate_digest`);
  expect(jobsHref({ job: 'gate_digest', run: RUN })).toBe(
    `${JOBS_BASE}?job=gate_digest&run=scheduled__2026-06-01T00%3A00%3A00%2B00%3A00`,
  );
  expect(jobsHref({ job: 'j', run: 'r', step: 's', try: 2, map: -1 })).toBe(`${JOBS_BASE}?job=j&run=r&step=s&try=2`);
  expect(jobsHref({ job: 'j', run: 'r', step: 's', try: 1, map: 3 })).toBe(`${JOBS_BASE}?job=j&run=r&step=s&try=1&map=3`);
});

it('reads the screen back from the search parameters', () => {
  expect(parseJobsView({})).toEqual({ kind: 'list' });
  expect(parseJobsView({ job: '' })).toEqual({ kind: 'list' });
  expect(parseJobsView({ tab: 'actions' })).toEqual({ kind: 'actions', job: null, page: 1 });
  expect(parseJobsView({ tab: 'actions', job: 'a', page: '3' })).toEqual({ kind: 'actions', job: 'a', page: 3 });
  expect(parseJobsView({ tab: 'other', job: 'a', page: ['2', '5'] })).toEqual({ kind: 'job', job: 'a', page: 2 });
  expect(parseJobsView({ job: 'a', page: '0' })).toEqual({ kind: 'job', job: 'a', page: 1 });
  expect(parseJobsView({ job: 'a', page: 'x' })).toEqual({ kind: 'job', job: 'a', page: 1 });
  expect(parseJobsView({ job: 'a', run: RUN })).toEqual({ kind: 'run', job: 'a', run: RUN, step: null });
  expect(parseJobsView({ job: 'a', run: RUN, step: 'digest', try: '2' })).toEqual({
    kind: 'run', job: 'a', run: RUN, step: { id: 'digest', try: 2, map: -1 },
  });
  expect(parseJobsView({ job: 'a', run: RUN, step: 'digest', try: '-1', map: '4' })).toEqual({
    kind: 'run', job: 'a', run: RUN, step: { id: 'digest', try: 1, map: 4 },
  });
});

it('round-trips a link through its own search parameters', () => {
  const href = jobsHref({ job: 'gate_digest', run: RUN, step: 'digest', try: 2 });
  const params = Object.fromEntries(new URL(href, 'http://x').searchParams);
  expect(parseJobsView(params)).toEqual({
    kind: 'run', job: 'gate_digest', run: RUN, step: { id: 'digest', try: 2, map: -1 },
  });
});

it('refuses an id the backend would refuse, before any screen is read', async () => {
  const { isJobsId } = await import('@/lib/jobs/paths');
  for (const ok of ['gate_digest', RUN, 'a.b', '.a', 'a@b-c', 'x'.repeat(250)]) expect(isJobsId(ok)).toBe(true);
  for (const bad of ['.', '..', '...', '', 'a/b', 'a b', 'a%2e', 'x'.repeat(251)]) expect(isJobsId(bad)).toBe(false);
  expect(parseJobsView({ job: '..' })).toEqual({ kind: 'invalid', id: '..' });
  expect(parseJobsView({ job: 'a', run: '.' })).toEqual({ kind: 'invalid', id: '.' });
  expect(parseJobsView({ job: 'a', run: RUN, step: '../x' })).toEqual({ kind: 'invalid', id: '../x' });
  expect(parseJobsView({ tab: 'actions', job: '..' })).toEqual({ kind: 'invalid', id: '..' });
});

it('refuses ~, Airflow\'s "all" wildcard, as the backend does (review 2026-11-12)', async () => {
  const { isJobsId } = await import('@/lib/jobs/paths');
  for (const bad of ['~', 'a~b', 'a@b~c-d']) expect(isJobsId(bad)).toBe(false);
  expect(parseJobsView({ job: '~' })).toEqual({ kind: 'invalid', id: '~' });
  expect(parseJobsView({ job: 'a', run: 'manual~x' })).toEqual({ kind: 'invalid', id: 'manual~x' });
});

it("accepts Unicode letters and digits, as the backend's \\w does", async () => {
  const { isJobsId } = await import('@/lib/jobs/paths');
  for (const ok of ['é', '作业_1', 'день', 'job_٣', '.作业']) expect(isJobsId(ok)).toBe(true);
  expect(parseJobsView({ job: '作业_1' })).toEqual({ kind: 'job', job: '作业_1', page: 1 });
  // At most 250 characters as Python counts them (code points), not UTF-16 units.
  expect(isJobsId('𝑥'.repeat(250))).toBe(true);
  expect(isJobsId('𝑥'.repeat(251))).toBe(false);
});
