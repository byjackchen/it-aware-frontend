import { describe, it, expect } from 'vitest';
import { pinPosition } from './scale';

/**
 * 抽屉里红黄绿刻度条上的定位圆点。
 * 公式照搬原型 getPinPos()（original-dashboard.html:808-812），
 * 包括它那个看似随意的 16 + ratio*66 —— 那是为了让圆点落在色带可视区内。
 */
describe('pinPosition', () => {
  it('当前值等于基线时落在起点 16%', () => {
    expect(pinPosition(80, 80, 90)).toBeCloseTo(16, 6);
  });

  it('当前值等于目标时落在 82%（16+66）', () => {
    expect(pinPosition(80, 90, 90)).toBeCloseTo(82, 6);
  });

  it('hardware 基线80/当前90/目标90 → 82%，与原型内联样式一致', () => {
    expect(pinPosition(80, 90, 90)).toBeCloseTo(82, 6);
  });

  it('处于基线与目标中点时落在 49%', () => {
    expect(pinPosition(80, 85, 90)).toBeCloseTo(49, 6);
  });

  it('超出目标时被截断在 95%，不会溢出色带', () => {
    expect(pinPosition(80, 200, 90)).toBe(95);
  });

  it('远低于基线时被截断在 5%', () => {
    expect(pinPosition(80, -100, 90)).toBe(5);
  });

  it('基线与目标相等时无法计算比例，回落到 50%', () => {
    expect(pinPosition(90, 95, 90)).toBe(50);
  });

  it('缺少任一数值时回落到 50%', () => {
    expect(pinPosition(null, 90, 90)).toBe(50);
    expect(pinPosition(80, null, 90)).toBe(50);
    expect(pinPosition(80, 90, null)).toBe(50);
  });

  it('目标低于基线（越小越好）时方向依然正确', () => {
    // reassign: 基线3% → 目标1%，当前1.6% 应落在偏右（接近目标）位置
    const pos = pinPosition(3, 1.6, 1);
    expect(pos).toBeGreaterThan(16);
    expect(pos).toBeLessThan(82);
  });
});
