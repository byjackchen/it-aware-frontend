import type { GapResult, MetricDefinition } from './types';

/** 浮点相减会留下 -11.339999999999996 这类毛刺，按展示精度归整。 */
function round(n: number, decimals: number): number {
  const f = 10 ** Math.min(decimals + 4, 12);
  return Math.round(n * f) / f;
}

/**
 * 计算当前值与目标的差距。
 *
 * delta 的符号统一表示"距离目标还差多少"：负数未达标，正数已超出。
 * 因此 LOWER_BETTER 下需取反 —— mttr 28分钟对目标 ≤60分钟是超额完成，delta 为正。
 */
export function computeGap(metric: MetricDefinition, value: number | null): GapResult {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { met: false, delta: null, pending: true };
  }
  if (metric.target === null || metric.target === undefined) {
    return { met: false, delta: null, pending: false };
  }

  const raw =
    metric.direction === 'LOWER_BETTER' ? metric.target - value : value - metric.target;
  const delta = round(raw, metric.decimals);

  return { met: delta >= 0, delta, pending: false };
}

/**
 * 百分比类指标的差距单位是 pp（百分点），不是 %。
 * 原型对此是刻意区分的：96% 与目标 98% 的差距写作 -2.00pp。
 */
function gapUnit(metric: MetricDefinition): string {
  return metric.unit === 'PERCENT' ? 'pp' : '';
}

/**
 * 总览卡片的差距文案：带符号。
 * 对应原型 domain-metric-gap，例如 "Gap：-11.34pp"、达标时 "✓ 健康"。
 */
export function formatGapOverview(metric: MetricDefinition, value: number | null): string {
  const g = computeGap(metric, value);
  if (g.pending) return '待接入';
  if (g.delta === null) return '待接入';
  if (g.met) return '✓ 健康';

  return `Gap：${g.delta.toFixed(metric.decimals)}${gapUnit(metric)}`;
}

/**
 * 抽屉详情的差距文案：取绝对值、达标时用词也不同。
 *
 * 这是原型自身的不一致（同一指标总览显示 -2.00pp、详情显示 2.00pp，
 * 达标时总览 "✓ 健康"、详情 "已达标"），这里如实保留而非"修正"，
 * 以免与原型对照时产生视觉差异。
 */
export function formatGapDetail(metric: MetricDefinition, value: number | null): string {
  const g = computeGap(metric, value);
  if (g.pending) return '待接入';
  if (g.delta === null) return '待接入';
  if (g.met) return '已达标';

  return `${Math.abs(g.delta).toFixed(metric.decimals)}${gapUnit(metric)}`;
}
