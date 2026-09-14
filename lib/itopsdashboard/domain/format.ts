import type { MetricDefinition, MetricStatus } from './types';

/** 无数据时的占位符，与原型 ai_self_service 的显示一致。 */
export const EMPTY_VALUE = '—';

/**
 * 按单位格式化指标值。
 *
 * 每种写法都逐字对齐原型，包括看起来不规整的空格：
 * SCORE 是 "90 /100"（斜杠前有空格、后无），
 * RATING 是 "4.2 / 5"（斜杠两侧都有空格）。
 * 这些差异保留原样，以保证与原型像素级一致。
 */
export function formatValue(metric: MetricDefinition, value: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return EMPTY_VALUE;
  }

  const n = value.toFixed(metric.decimals);

  switch (metric.unit) {
    case 'PERCENT':
      return `${n}%`;
    case 'SCORE':
      return `${n} /${metric.scaleMax ?? 100}`;
    case 'RATING':
      return `${n} / ${metric.scaleMax ?? 5}`;
    case 'DURATION':
      return `${n}分钟`;
    case 'COUNT':
      return n;
    default:
      return n;
  }
}

/**
 * 状态文案不在此处。
 *
 * 原项目这里有个 statusLabel() 返回硬编码中文（对应原型 statusText()，
 * original-dashboard.html:736）。IT-Aware 是中英双语的，用户可见文案统一由
 * next-intl 提供，故该函数未一并搬入 —— 文案见 messages/{zh,en}.json 的
 * `ItopsOverview.status.*`，消费方是 components/itopsdashboard/StatusBadge.tsx。
 *
 * 下面的 statusClass 保留，因为它产出的是 CSS 类名而非文案，不需要翻译。
 */

/**
 * 状态对应的 CSS 类名。
 * 沿用原型 badge 的类名（green/yellow/red/gray），使原型 CSS 可直接复用。
 */
export function statusClass(status: MetricStatus): string {
  switch (status) {
    case 'GREEN':
      return 'green';
    case 'YELLOW':
      return 'yellow';
    case 'RED':
      return 'red';
    case 'PENDING':
      return 'gray';
  }
}
