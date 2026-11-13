/**
 * The key metrics on the home's task cards (backend GET /tasks/metrics): which
 * a card shows, and how a value, its change and its age are written.
 */

import type { TaskMetric } from '@/lib/types/tasks';

/** A card shows at most this many metrics. */
export const METRICS_PER_TASK = 2;

/** At and above this, a count is written in compact form (1.2M). */
const COMPACT_FROM = 100_000;

const isNames = (names: unknown): boolean =>
    typeof (names as TaskMetric['label'] | null)?.en === 'string' && typeof (names as TaskMetric['label']).zh === 'string';

/**
 * Whether an entry of the answer can be shown: it names its task, has a
 * finite value, a label, a period, and a `computed_at` that is a time. The one
 * place a malformed metric is dropped, so no card ever has to draw one.
 */
function isMetric(entry: unknown): entry is TaskMetric {
    const metric = entry as Partial<TaskMetric> | null;
    return typeof metric?.task === 'string'
        && typeof metric.code === 'string'
        && typeof metric.value === 'number' && Number.isFinite(metric.value)
        && isNames(metric.label)
        && typeof metric.period?.kind === 'string'
        && typeof metric.computed_at === 'string' && !Number.isNaN(Date.parse(metric.computed_at));
}

/**
 * Each task's metrics, in the order the backend answered them, at most two a
 * task. `metrics` is the answer's list as it came: anything that is no list,
 * and every malformed entry, is left out.
 */
export function metricsByTask(metrics: unknown): Map<string, TaskMetric[]> {
    const byTask = new Map<string, TaskMetric[]>();
    for (const metric of Array.isArray(metrics) ? metrics.filter(isMetric) : []) {
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

/** The earliest of the metrics' `computed_at`: what a card says it was updated. */
export function oldestComputed(metrics: TaskMetric[]): string {
    return metrics.map(metric => metric.computed_at).reduce((oldest, at) => (Date.parse(at) < Date.parse(oldest) ? at : oldest));
}

/** How long before `now` an instant was, in the person's language: "5 minutes ago", "yesterday". */
export function ago(instant: string, now: Date, locale: string): string {
    const elapsed = Math.max(0, now.getTime() - new Date(instant).getTime());
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute');
    if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour');
    return relative.format(-Math.floor(elapsed / DAY), 'day');
}
