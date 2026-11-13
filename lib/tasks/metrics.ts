/**
 * The key metrics on the home's task cards (backend GET /tasks/metrics): which
 * a card shows, and how a value, its change and its age are written.
 */

import type { TaskMetric } from '@/lib/types/tasks';

/** A card shows at most this many metrics. */
export const METRICS_PER_TASK = 2;

/** At and above this, a count is written in compact form (1.2M). */
const COMPACT_FROM = 100_000;

/** Each task's metrics, in the order the backend answered them, at most two a task. */
export function metricsByTask(metrics: TaskMetric[]): Map<string, TaskMetric[]> {
    const byTask = new Map<string, TaskMetric[]>();
    for (const metric of metrics) {
        const held = byTask.get(metric.task) ?? [];
        if (held.length < METRICS_PER_TASK) byTask.set(metric.task, [...held, metric]);
    }
    return byTask;
}

function written(value: number, unit: TaskMetric['unit'], locale: string, signed: boolean): string {
    const signDisplay = signed ? 'exceptZero' : 'auto';
    if (unit === 'percent') {
        return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay }).format(value);
    }
    return Math.abs(value) >= COMPACT_FROM
        ? new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1, signDisplay }).format(value)
        : new Intl.NumberFormat(locale, { maximumFractionDigits: 0, signDisplay }).format(value);
}

/**
 * A metric's value: a count with thousands separators, compact from 100,000
 * (1.2M); a percent with one decimal (91.6%).
 */
export function metricValue(metric: Pick<TaskMetric, 'value' | 'unit'>, locale: string): string {
    const value = written(metric.value, metric.unit, locale, false);
    return metric.unit === 'percent' ? `${value}%` : value;
}

/**
 * The change against the period before, as a plain signed difference (+6,
 * -1.2, 0); null when there is no earlier value.
 */
export function metricChange(metric: Pick<TaskMetric, 'value' | 'unit' | 'previous_value'>, locale: string): string | null {
    if (metric.previous_value == null) return null;
    return written(metric.value - metric.previous_value, metric.unit, locale, true);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long before `now` an instant was, in the person's language: "5 minutes ago", "yesterday". */
export function ago(instant: string, now: Date, locale: string): string {
    const elapsed = Math.max(0, now.getTime() - new Date(instant).getTime());
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute');
    if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour');
    return relative.format(-Math.floor(elapsed / DAY), 'day');
}
