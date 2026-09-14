/**
 * 看板领域类型。
 *
 * 这些定义全部逆向自原型 reference/original-dashboard.html：
 * 原型把状态、目标、差距都写成了硬编码字符串（如 status:'yellow'、gap:'Gap：-2.00pp'），
 * 健康度规则虽然在 details[].health 里写全了，却没有任何代码执行它。
 * 这里把规则变成可执行的数据。
 */

/** 状态四态。gray/PENDING 表示数据源尚未接入，不是"不健康"。 */
export type MetricStatus = 'GREEN' | 'YELLOW' | 'RED' | 'PENDING';

/**
 * 指标方向性。原型中四种都有实例：
 * - HIGHER_BETTER: sla 目标 ≥98%
 * - LOWER_BETTER:  reassign 目标 ≤1%
 * - BAND:          健康区间型，过高过低都不好
 * - QUALITATIVE:   健康规则是文字描述、无法数值化，取人工标注状态
 */
export type MetricDirection = 'HIGHER_BETTER' | 'LOWER_BETTER' | 'BAND' | 'QUALITATIVE';

/** 展示单位。五种全部出现在原型中。 */
export type MetricUnit =
  | 'PERCENT' // 96.00%
  | 'SCORE' // 90 /100
  | 'RATING' // 4.2 / 5
  | 'DURATION' // 28分钟
  | 'COUNT'; // 0 / 3

/**
 * 单调型阈值。语义随 direction 变化：
 * - HIGHER_BETTER: value >= green → 绿；value >= yellow → 黄；否则红
 * - LOWER_BETTER:  value <= green → 绿；value <= yellow → 黄；否则红
 *
 * 阈值与 target 是**两个独立概念**，不可互相推导。
 * 证据：asset_accuracy 目标 100%、当前 98%，原型判绿，
 * 因为它的 health 规则是 ['<95%','95%–<98%','≥98%'] —— 绿色门槛 98% ≠ 目标 100%。
 */
export interface MonotonicThresholds {
  kind: 'MONOTONIC';
  green: number;
  yellow: number;
}

/** 区间型阈值：绿区间内为绿，黄区间内为黄，区间外为红。 */
export interface BandThresholds {
  kind: 'BAND';
  greenMin: number;
  greenMax: number;
  yellowMin: number;
  yellowMax: number;
}

export type MetricThresholds = MonotonicThresholds | BandThresholds;

/**
 * 状态判定与格式化所需的最小指标定义。
 * 完整的指标实体（口径、负责人、数据源等）见 db schema，此处只放计算相关字段，
 * 以保证 lib/domain 下全部为无 IO 的纯函数。
 */
export interface MetricDefinition {
  code: string;
  unit: MetricUnit;
  direction: MetricDirection;
  /** 展示小数位。原型中同为百分比却有 0/1/2 位三种（65% / 97.6% / 96.00%），故按指标存。 */
  decimals: number;
  /** SCORE 与 RATING 的分母，如 100、5。其余单位为 null。 */
  scaleMax: number | null;
  baseline: number | null;
  target: number | null;
  thresholds: MetricThresholds | null;
  /** 仅 QUALITATIVE 使用：规则无法数值化时的人工判定。 */
  manualStatus?: MetricStatus | null;
  /**
   * 健康规则是否已定稿。为 false 时即便算得出结果也不发布状态。
   *
   * 原型中的灰色徽章有两种含义，需区分：
   *   一是数据源未接入（ai_self_service 的值是"—"）；
   *   二是规则尚未定稿——reassign 有值 1.60%、规则也写全了，却仍标灰，
   *   support 注明"状态规则待最终确认"；fcr 同理。
   * 规则未定就发布状态，等于替业务做了尚未达成一致的判断。
   */
  ruleConfirmed?: boolean;
}

/** 差距计算结果。delta 为 null 表示无法计算（无数据或无目标）。 */
export interface GapResult {
  /** 是否已达标 */
  met: boolean;
  /**
   * 带符号的差距，符号表示"距离目标还差多少"：
   * 负数 = 尚未达标，正数 = 超出目标。
   * HIGHER_BETTER 下 = value - target；LOWER_BETTER 下 = target - value。
   */
  delta: number | null;
  /** 无数据时为 true，对应"待接入" */
  pending: boolean;
}
