import { describe, it, expect } from 'vitest';
import { resolveStatus } from './status';
import type { MetricDefinition, MetricStatus } from './types';

/**
 * 全部用例取自 reference/original-dashboard.html 的真实数据：
 * 阈值来自 details[].health 的文字规则，期望状态来自原型自己标注的 status 字段。
 * 目的是证明"把规则变成代码"后，判定结果与原型人工标注一致。
 */

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

function higher(green: number, yellow: number, target: number, baseline: number | null = null) {
  return metric({
    direction: 'HIGHER_BETTER',
    thresholds: { kind: 'MONOTONIC', green, yellow },
    target,
    baseline,
  });
}

function lower(green: number, yellow: number, target: number, baseline: number | null = null) {
  return metric({
    direction: 'LOWER_BETTER',
    thresholds: { kind: 'MONOTONIC', green, yellow },
    target,
    baseline,
  });
}

describe('resolveStatus — 越大越好（HIGHER_BETTER）', () => {
  // 表格：[指标 code, 阈值绿, 阈值黄, 目标, 当前值, 原型标注状态]
  const cases: Array<[string, number, number, number, number, MetricStatus]> = [
    // health: ['<90%','90%–<98%','≥98%']
    ['sla', 98, 90, 98, 96.0, 'YELLOW'],
    ['response_sla', 98, 90, 98, 96.8, 'YELLOW'],
    ['overall_sla', 98, 95, 98, 98.3, 'GREEN'],
    // health: ['<4.0','4.0–<4.5','≥4.5']
    ['csat', 4.5, 4.0, 4.5, 4.2, 'YELLOW'],
    // health: ['<90%','90%–<95%','≥95%']
    ['software_health', 95, 90, 95, 91.16, 'YELLOW'],
    // health: ['<60%','60%–<80%','≥80%']
    ['license_active', 80, 60, 80, 68.66, 'YELLOW'],
    // health: ['<70','70–<90','≥90']
    ['office_health', 90, 70, 90, 90, 'GREEN'],
    // health: ['<80','80–<90','≥90']
    ['hardware', 90, 80, 90, 90, 'GREEN'],
    // health: ['<99.5%','99.5%–<99.9%','≥99.9%']
    ['network', 99.9, 99.5, 99.9, 99.92, 'GREEN'],
    // health: ['<95%','95%–<98%','≥98%']
    ['meeting', 98, 95, 98, 97.6, 'YELLOW'],
    // health: ['<75%','75%–<90%','≥90%']
    ['standard', 90, 75, 90, 90, 'GREEN'],
    // health: ['<70%','70%–<95%','≥95%']
    ['execution', 95, 70, 95, 82, 'YELLOW'],
    // health: ['<50%','50%–<75%','≥75%']
    ['knowledge', 75, 50, 75, 68, 'YELLOW'],
    // health: ['<60%','60%–<80%','≥80%']
    ['automation', 80, 60, 80, 55, 'RED'],
    // health: ['≥90%且预测偏差≤10%']
    ['budget', 90, 85, 90, 92, 'GREEN'],
    // health: ['<60%','60%–<75%','≥75%']
    ['fcr', 75, 60, 75, 65, 'YELLOW'],
  ];

  it.each(cases)('%s 当前 %s → 与原型标注一致', (code, green, yellow, target, value, expected) => {
    expect(resolveStatus(higher(green, yellow, target), value)).toBe(expected);
  });

  it('边界：恰好等于绿色门槛判绿（office_health 90 / 门槛 90）', () => {
    expect(resolveStatus(higher(90, 70, 90), 90)).toBe('GREEN');
  });

  it('边界：恰好等于黄色门槛判黄，低一点即判红', () => {
    const m = higher(98, 90, 98);
    expect(resolveStatus(m, 90)).toBe('YELLOW');
    expect(resolveStatus(m, 89.99)).toBe('RED');
  });
});

describe('resolveStatus — 越小越好（LOWER_BETTER）', () => {
  it('mttr 28分钟 / 绿≤60 黄≤240 → 绿（原型标注 green）', () => {
    expect(resolveStatus(lower(60, 240, 60, 240), 28)).toBe('GREEN');
  });

  it('reopen 3.2% / 绿≤5 黄≤8 → 绿（原型标注 green）', () => {
    expect(resolveStatus(lower(5, 8, 5, 8), 3.2)).toBe('GREEN');
  });

  it('reassign 1.60% / 绿≤1 黄≤3 → 黄（规则确认后应判黄，见下方 QUALITATIVE 说明）', () => {
    expect(resolveStatus(lower(1, 3, 1, 3), 1.6)).toBe('YELLOW');
  });

  it('超出黄色门槛判红', () => {
    expect(resolveStatus(lower(1, 3, 1), 3.5)).toBe('RED');
  });

  it('边界：恰好等于绿色门槛判绿', () => {
    expect(resolveStatus(lower(1, 3, 1), 1)).toBe('GREEN');
  });
});

describe('resolveStatus — 区间健康（BAND）', () => {
  const band = metric({
    direction: 'BAND',
    thresholds: { kind: 'BAND', greenMin: 8, greenMax: 15, yellowMin: 5, yellowMax: 20 },
    target: 10,
  });

  it('落在绿区间内判绿', () => {
    expect(resolveStatus(band, 12.6)).toBe('GREEN');
  });

  it('低于绿区间但在黄区间内判黄（过低同样不健康）', () => {
    expect(resolveStatus(band, 6)).toBe('YELLOW');
  });

  it('高于绿区间但在黄区间内判黄', () => {
    expect(resolveStatus(band, 18)).toBe('YELLOW');
  });

  it('黄区间之外判红，两侧对称', () => {
    expect(resolveStatus(band, 3)).toBe('RED');
    expect(resolveStatus(band, 25)).toBe('RED');
  });
});

describe('resolveStatus — 待接入与定性判定', () => {
  it('无数据一律判 PENDING（ai_self_service / ai_adoption / topissue）', () => {
    expect(resolveStatus(higher(30, 10, 30), null)).toBe('PENDING');
  });

  it('即便配了阈值，只要没有本周值仍是 PENDING，不能当成 0 判红', () => {
    expect(resolveStatus(higher(80, 60, 80), null)).toBe('PENDING');
  });

  it('QUALITATIVE 取人工标注（inventory_ratio：目标10% 当前12.6% 原型判绿）', () => {
    const m = metric({
      code: 'inventory_ratio',
      direction: 'QUALITATIVE',
      target: 10,
      baseline: 15,
      manualStatus: 'GREEN',
    });
    expect(resolveStatus(m, 12.6)).toBe('GREEN');
  });

  it('QUALITATIVE 未标注人工状态时回落到 PENDING', () => {
    const m = metric({ direction: 'QUALITATIVE', manualStatus: null });
    expect(resolveStatus(m, 12.6)).toBe('PENDING');
  });

  it('缺少阈值配置时回落到 PENDING，而不是抛错或误判', () => {
    expect(resolveStatus(metric({ thresholds: null }), 96)).toBe('PENDING');
  });
});

describe('resolveStatus — 规则未定稿时不发布状态', () => {
  /**
   * 原型的灰色徽章有两种成因，必须区分：
   * 数据未接入（值为"—"）vs 规则待确认（有值有规则，但口径未定稿）。
   * reassign 与 fcr 属于后者，原型 support 分别注明
   * "状态规则待最终确认" / "当前状态待确认"。
   */
  it('reassign 1.60% 规则未定稿 → PENDING，与原型标注一致', () => {
    const m = metric({
      code: 'reassign',
      direction: 'LOWER_BETTER',
      thresholds: { kind: 'MONOTONIC', green: 1, yellow: 3 },
      target: 1,
      ruleConfirmed: false,
    });
    expect(resolveStatus(m, 1.6)).toBe('PENDING');
  });

  it('fcr 65% 规则未定稿 → PENDING，与原型标注一致', () => {
    const m = metric({
      code: 'fcr',
      thresholds: { kind: 'MONOTONIC', green: 75, yellow: 60 },
      target: 75,
      ruleConfirmed: false,
    });
    expect(resolveStatus(m, 65)).toBe('PENDING');
  });

  it('规则定稿后同样的值即可发布状态', () => {
    const m = metric({
      thresholds: { kind: 'MONOTONIC', green: 75, yellow: 60 },
      target: 75,
      ruleConfirmed: true,
    });
    expect(resolveStatus(m, 65)).toBe('YELLOW');
  });

  it('未显式声明时默认视为已定稿，不影响其余指标', () => {
    const m = metric({ thresholds: { kind: 'MONOTONIC', green: 98, yellow: 90 }, target: 98 });
    expect(resolveStatus(m, 96)).toBe('YELLOW');
  });
});

describe('resolveStatus — 阈值与目标是两个独立概念', () => {
  /**
   * 这是原型里最容易被误读的一条：
   * asset_accuracy 目标 100%、当前 98%、Gap -2.0pp，原型却判绿。
   * 原因是它的 health 规则绿色门槛是 98%，不是目标 100%。
   * 若用 target 反推阈值，这里会错判成黄。
   */
  it('asset_accuracy 98% / 目标100% / 绿色门槛98% → 绿', () => {
    const m = higher(98, 95, 100, 95);
    expect(resolveStatus(m, 98)).toBe('GREEN');
  });

  it('反例：若错误地用 target 当绿色门槛，会误判为黄', () => {
    const wrong = higher(100, 95, 100, 95);
    expect(resolveStatus(wrong, 98)).toBe('YELLOW');
  });
});
