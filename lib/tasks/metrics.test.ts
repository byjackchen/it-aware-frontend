import { describe, expect, it } from 'vitest';
import { ago, metricChange, metricValue, metricsByTask } from '@/lib/tasks/metrics';
import type { TaskMetric } from '@/lib/types/tasks';

const metric = (task: string, code: string, more: Partial<TaskMetric> = {}): TaskMetric => ({
    task, code, label: { en: code, zh: code }, unit: 'count', value: 1,
    period: { start: '2026-11-01', end: '2026-11-12', kind: 'now' }, previous_value: null,
    computed_at: '2026-11-12T08:00:00Z', ...more,
});

describe("a card's metrics", () => {
    it("are the task's own, in the order answered, at most two", () => {
        const byTask = metricsByTask([
            metric('it-tickets', 'active'), metric('it-incidents', 'open'), metric('it-tickets', 'sla'), metric('it-tickets', 'third'),
        ]);
        expect([...byTask.keys()]).toEqual(['it-tickets', 'it-incidents']);
        expect(byTask.get('it-tickets')!.map(held => held.code)).toEqual(['active', 'sla']);
        expect(byTask.get('it-incidents')!.map(held => held.code)).toEqual(['open']);
        expect(metricsByTask([]).size).toBe(0);
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
