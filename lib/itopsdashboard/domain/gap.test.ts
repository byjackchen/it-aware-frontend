import { describe, it, expect } from 'vitest';
import { computeGap, formatGapOverview, formatGapDetail } from './gap';
import type { MetricDefinition } from './types';

function metric(over: Partial<MetricDefinition>): MetricDefinition {
  return {
    code: 'test',
    unit: 'PERCENT',
    direction: 'HIGHER_BETTER',
    decimals: 2,
    scaleMax: null,
    baseline: null,
    target: null,
    thresholds: null,
    ...over,
  };
}

describe('computeGap', () => {
  it('未达标时 delta 为负（sla 96 / 目标 98）', () => {
    const g = computeGap(metric({ target: 98 }), 96);
    expect(g.met).toBe(false);
    expect(g.delta).toBeCloseTo(-2, 10);
    expect(g.pending).toBe(false);
  });

  it('达标时 met 为真、delta 为正（network 99.92 / 目标 99.9）', () => {
    const g = computeGap(metric({ target: 99.9 }), 99.92);
    expect(g.met).toBe(true);
    expect(g.delta).toBeCloseTo(0.02, 10);
  });

  it('恰好等于目标算达标（hardware 90 / 目标 90）', () => {
    expect(computeGap(metric({ target: 90 }), 90).met).toBe(true);
  });

  it('越小越好时符号取反：低于目标才是达标（mttr 28 / 目标 ≤60）', () => {
    const g = computeGap(metric({ direction: 'LOWER_BETTER', target: 60 }), 28);
    expect(g.met).toBe(true);
    expect(g.delta).toBeCloseTo(32, 10);
  });

  it('越小越好且超标时 delta 为负（reassign 1.6 / 目标 ≤1）', () => {
    const g = computeGap(metric({ direction: 'LOWER_BETTER', target: 1 }), 1.6);
    expect(g.met).toBe(false);
    expect(g.delta).toBeCloseTo(-0.6, 10);
  });

  it('无数据时 pending 为真、delta 为 null', () => {
    const g = computeGap(metric({ target: 30 }), null);
    expect(g.pending).toBe(true);
    expect(g.delta).toBeNull();
    expect(g.met).toBe(false);
  });

  it('无目标时同样无法计算差距', () => {
    const g = computeGap(metric({ target: null }), 96);
    expect(g.delta).toBeNull();
  });

  it('浮点相减不产生精度毛刺（license_active 68.66 / 目标 80）', () => {
    const g = computeGap(metric({ target: 80 }), 68.66);
    expect(g.delta).toBeCloseTo(-11.34, 10);
  });
});

describe('formatGapOverview — 总览卡片：带符号', () => {
  it('百分比差距用 pp（百分点）而非 %', () => {
    expect(formatGapOverview(metric({ target: 98 }), 96)).toBe('Gap：-2.00pp');
  });

  it('license_active 与原型一致', () => {
    expect(formatGapOverview(metric({ target: 80 }), 68.66)).toBe('Gap：-11.34pp');
  });

  it('software_health 与原型一致', () => {
    expect(formatGapOverview(metric({ target: 95 }), 91.16)).toBe('Gap：-3.84pp');
  });

  it('评分类不带 pp，按自身小数位（csat 4.2 / 目标 4.5）', () => {
    const m = metric({ unit: 'RATING', decimals: 1, scaleMax: 5, target: 4.5 });
    expect(formatGapOverview(m, 4.2)).toBe('Gap：-0.3');
  });

  it('达标时总览显示 ✓ 健康（原型 inventory_ratio 的写法）', () => {
    expect(formatGapOverview(metric({ target: 99.9 }), 99.92)).toBe('✓ 健康');
  });

  it('无数据显示 待接入', () => {
    expect(formatGapOverview(metric({ target: 30 }), null)).toBe('待接入');
  });
});

describe('formatGapDetail — 抽屉详情：取绝对值', () => {
  it('同一指标在抽屉里不带符号（原型总览 -2.00pp、详情 2.00pp）', () => {
    expect(formatGapDetail(metric({ target: 98 }), 96)).toBe('2.00pp');
  });

  it('达标时显示 已达标，与总览的 ✓ 健康 用词不同', () => {
    expect(formatGapDetail(metric({ target: 99.9 }), 99.92)).toBe('已达标');
  });

  it('无数据显示 待接入', () => {
    expect(formatGapDetail(metric({ target: 30 }), null)).toBe('待接入');
  });
});
