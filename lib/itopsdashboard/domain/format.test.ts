import { describe, it, expect } from 'vitest';
import { formatValue, statusClass } from './format';
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

describe('formatValue — 与原型逐字一致', () => {
  it('百分比两位小数（sla）', () => {
    expect(formatValue(metric({ decimals: 2 }), 96)).toBe('96.00%');
  });

  it('百分比一位小数（meeting 97.6%）', () => {
    expect(formatValue(metric({ decimals: 1 }), 97.6)).toBe('97.6%');
  });

  it('百分比零位小数（fcr 65%）', () => {
    expect(formatValue(metric({ decimals: 0 }), 65)).toBe('65%');
  });

  it('同为百分比却有三种小数位，故小数位必须按指标存', () => {
    expect(formatValue(metric({ decimals: 2 }), 1.6)).toBe('1.60%');
    expect(formatValue(metric({ decimals: 2 }), 99.92)).toBe('99.92%');
    expect(formatValue(metric({ decimals: 0 }), 98)).toBe('98%');
  });

  it('评分制带分母，斜杠前有空格（office_health 90 /100）', () => {
    const m = metric({ unit: 'SCORE', decimals: 0, scaleMax: 100 });
    expect(formatValue(m, 90)).toBe('90 /100');
  });

  it('满意度斜杠两侧都有空格（csat 4.2 / 5）', () => {
    const m = metric({ unit: 'RATING', decimals: 1, scaleMax: 5 });
    expect(formatValue(m, 4.2)).toBe('4.2 / 5');
  });

  it('时长带中文单位（mttr 28分钟）', () => {
    const m = metric({ unit: 'DURATION', decimals: 0 });
    expect(formatValue(m, 28)).toBe('28分钟');
  });

  it('计数为纯数字', () => {
    expect(formatValue(metric({ unit: 'COUNT', decimals: 0 }), 3)).toBe('3');
  });

  it('无数据显示破折号，与原型 ai_self_service 一致', () => {
    expect(formatValue(metric({}), null)).toBe('—');
  });
});

// statusLabel 的用例不在此处：文案已交给 next-intl，见 format.ts 的说明。

describe('statusClass — 对应原型 badge 的 class 名', () => {
  it('沿用原型 CSS 类名，保证样式可直接复用', () => {
    expect(statusClass('GREEN')).toBe('green');
    expect(statusClass('YELLOW')).toBe('yellow');
    expect(statusClass('RED')).toBe('red');
    expect(statusClass('PENDING')).toBe('gray');
  });
});
