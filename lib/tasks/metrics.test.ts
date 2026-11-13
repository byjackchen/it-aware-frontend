import { describe, expect, it } from 'vitest';
import { ago, metricChange, metricValue, metricsByTask, oldestComputed } from '@/lib/tasks/metrics';
import type { TaskMetric } from '@/lib/types/tasks';

const metric = (task: string, code: string, more: Partial<TaskMetric> = {}): TaskMetric => ({
    task, code, label: { en: code, zh: code }, unit: 'count', value: 1,
    period: { start: '2026-11-01', end: '2026-11-12', kind: 'now' }, previous_value: null,
    computed_at: '2026-11-12T08:00:00Z', ...more,
});

describe("a card's metrics", () => {
    it("are the task's own, in the order answered, at most three", () => {
        const byTask = metricsByTask([
            metric('it-tickets', 'active'), metric('it-incidents', 'open'), metric('it-tickets', 'sla'),
            metric('it-tickets', 'third'), metric('it-tickets', 'fourth'),
        ]);
        expect([...byTask.keys()]).toEqual(['it-tickets', 'it-incidents']);
        expect(byTask.get('it-tickets')!.map(held => held.code)).toEqual(['active', 'sla', 'third']);
        expect(byTask.get('it-incidents')!.map(held => held.code)).toEqual(['open']);
        expect(metricsByTask([]).size).toBe(0);
    });

    it('keep a value of 0: it is a number like any other', () => {
        const zero = metric('data-overview', 'data-overview.raw', { value: 0 });
        expect(metricsByTask([zero]).get('data-overview')).toEqual([zero]);
        expect(metricValue(zero, 'en')).toBe('0');
    });
});

describe('a malformed metric', () => {
    const good = metric('it-tickets', 'active');
    const shown = (entries: unknown) => [...metricsByTask(entries).values()].flat();

    it.each([
        ['no value', { ...good, value: undefined }],
        ['a value that is no number', { ...good, value: '41' }],
        ['a value that is not finite', { ...good, value: Number.NaN }],
        ['an infinite value', { ...good, value: Number.POSITIVE_INFINITY }],
        ['a null value', { ...good, value: null }],
        ['no computed_at', { ...good, computed_at: undefined }],
        ['a computed_at that is no time', { ...good, computed_at: 'yesterday-ish' }],
        ['no period', { ...good, period: undefined }],
        ['a null period', { ...good, period: null }],
        ['a period without a kind', { ...good, period: { start: '2026-11-01', end: '2026-11-12' } }],
        ['no label', { ...good, label: undefined }],
        ['a null label', { ...good, label: null }],
        ['a label in one language only', { ...good, label: { en: 'Active' } }],
        ['a label with no English', { ...good, label: { zh: '活跃' } }],
        ['no task', { ...good, task: undefined }],
        ['no code', { ...good, code: undefined }],
        ['null', null],
        ['a string', 'metric'],
    ])('is left out, the good ones kept: %s', (_shape, bad) => {
        expect(shown([bad, good])).toEqual([good]);
    });

    it('is nothing at all when the answer has no list', () => {
        expect(shown(undefined)).toEqual([]);
        expect(shown(null)).toEqual([]);
        expect(shown({ metrics: [good] })).toEqual([]);
    });
});

describe('when a card was updated', () => {
    it("is the earliest of its metrics' times", () => {
        const at = (computed_at: string) => metric('it-tickets', computed_at, { computed_at });
        expect(oldestComputed([at('2026-11-12T08:00:00Z')])).toBe('2026-11-12T08:00:00Z');
        expect(oldestComputed([at('2026-11-12T08:00:00Z'), at('2026-11-12T07:00:00Z')])).toBe('2026-11-12T07:00:00Z');
        expect(oldestComputed([at('2026-11-12T07:00:00Z'), at('2026-11-12T08:00:00Z')])).toBe('2026-11-12T07:00:00Z');
    });
});

describe("a metric's value", () => {
    it('writes a count with thousands separators, compact from 100,000', () => {
        const count = (value: number) => metricValue({ value, unit: 'count' }, 'en');
        expect(count(0)).toBe('0');
        expect(count(128)).toBe('128');
        expect(count(3412)).toBe('3,412');
        expect(count(99_999)).toBe('99,999');
        expect(count(100_000)).toBe('100K');
        expect(count(1_234_567)).toBe('1.2M');
        expect(metricValue({ value: 1_234_567, unit: 'count' }, 'zh')).toBe('123.5万');
    });

    it('writes a percent with one decimal', () => {
        expect(metricValue({ value: 91.6, unit: 'percent' }, 'en')).toBe('91.6%');
        expect(metricValue({ value: 100, unit: 'percent' }, 'en')).toBe('100.0%');
        expect(metricValue({ value: 7.25, unit: 'percent' }, 'zh')).toBe('7.3%');
    });
});

describe("a metric's change", () => {
    const change = (value: number, previous_value: number | null, unit: TaskMetric['unit'] = 'count') =>
        metricChange({ value, unit, previous_value }, 'en');

    it('is the plain signed difference from the period before', () => {
        expect(change(128, 122)).toBe('+6');
        expect(change(122, 128)).toBe('-6');
        expect(change(5, 5)).toBe('0');
        expect(change(1_500_000, 250_000)).toBe('+1.3M');
        expect(change(91.6, 90.4, 'percent')).toBe('+1.2');
        expect(change(90.4, 91.6, 'percent')).toBe('-1.2');
    });

    it('is absent without an earlier value', () => {
        expect(change(128, null)).toBeNull();
    });
});

describe('how long ago a metric was computed', () => {
    const now = new Date('2026-11-12T12:00:00Z');

    it('is written in minutes, hours, then days', () => {
        expect(ago('2026-11-12T11:55:00Z', now, 'en')).toBe('5 minutes ago');
        expect(ago('2026-11-12T09:00:00Z', now, 'en')).toBe('3 hours ago');
        expect(ago('2026-11-11T08:00:00Z', now, 'en')).toBe('yesterday');
        expect(ago('2026-11-09T12:00:00Z', now, 'en')).toBe('3 days ago');
        expect(ago('2026-11-12T11:55:00Z', now, 'zh')).toBe('5分钟前');
    });

    it('is "this minute" for now, and for a clock that runs ahead', () => {
        expect(ago('2026-11-12T12:00:00Z', now, 'en')).toBe('this minute');
        expect(ago('2026-11-12T12:03:00Z', now, 'en')).toBe('this minute');
    });
});
