/**
 * 抽屉详情中红黄绿刻度条上定位圆点的水平位置（百分比）。
 *
 * 公式与常量照搬原型 getPinPos()（reference/original-dashboard.html:808-812）：
 *   clamp(16 + (current-baseline)/(target-baseline) * 66, 5, 95)
 *
 * 16 与 66 不是任意值 —— 色带三段各占 33%，这组常量让"基线"落在首段内、
 * "目标"落在末段起点附近。改动会导致圆点与色带错位。
 */
export function pinPosition(
  baseline: number | null,
  current: number | null,
  target: number | null,
): number {
  if (baseline === null || current === null || target === null) return 50;
  if (!Number.isFinite(baseline) || !Number.isFinite(current) || !Number.isFinite(target)) {
    return 50;
  }
  // 基线与目标相等时比例无意义（除零），居中显示。
  if (target === baseline) return 50;

  const ratio = (current - baseline) / (target - baseline);
  return Math.max(5, Math.min(95, 16 + ratio * 66));
}
