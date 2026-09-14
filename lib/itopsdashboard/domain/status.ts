import type { MetricDefinition, MetricStatus } from './types';

/**
 * 由"当前值 + 阈值规则"判定指标状态。
 *
 * 这是全栈版相对原型最实质的改进：原型把 status 写成硬编码字符串
 * （reference/original-dashboard.html:625 等），健康规则只以文字存在于
 * details[].health 中，从未被执行；填错了页面也无从发现。
 *
 * 判定顺序（顺序本身即是规则，不可调换）：
 *   1. 无数据            → PENDING（"待接入"，不是"不健康"）
 *   2. 规则未定稿        → PENDING（有值也不发布，见 ruleConfirmed）
 *   3. QUALITATIVE       → 取人工标注
 *   4. 其余              → 按 direction + thresholds 计算
 *
 * 纯函数，无 IO，可直接单测。
 */
export function resolveStatus(metric: MetricDefinition, value: number | null): MetricStatus {
  // 1. 数据源尚未接入。必须先于一切判定 —— 否则 null 会被当作 0 误判为红。
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'PENDING';
  }

  // 2. 健康规则尚未定稿。有值也有阈值，但口径未达成一致（原型的 reassign / fcr），
  //    此时发布状态等于替业务做了尚未确认的判断，故显式保持"待接入"。
  if (metric.ruleConfirmed === false) {
    return 'PENDING';
  }

  // 3. 健康规则无法数值化（如 inventory_ratio 的"处于健康库存水位"），取人工判定。
  if (metric.direction === 'QUALITATIVE') {
    return metric.manualStatus ?? 'PENDING';
  }

  const t = metric.thresholds;
  if (!t) {
    // 阈值未配置时不猜，显式回落到待接入，避免给出看似确定的错误结论。
    return 'PENDING';
  }

  if (t.kind === 'BAND') {
    // 区间型：过高与过低同样不健康，两侧对称判定。
    if (value >= t.greenMin && value <= t.greenMax) return 'GREEN';
    if (value >= t.yellowMin && value <= t.yellowMax) return 'YELLOW';
    return 'RED';
  }

  // 单调型。注意阈值门槛与 target 是两个独立概念，
  // 例如 asset_accuracy 目标 100% 而绿色门槛 98%，用 target 反推会误判。
  if (metric.direction === 'LOWER_BETTER') {
    if (value <= t.green) return 'GREEN';
    if (value <= t.yellow) return 'YELLOW';
    return 'RED';
  }

  // HIGHER_BETTER
  if (value >= t.green) return 'GREEN';
  if (value >= t.yellow) return 'YELLOW';
  return 'RED';
}
