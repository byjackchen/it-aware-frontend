// Shared usage-filter helpers used by the usage page, its client, and the clear modal.

// Window preset → lookback hours. "custom" uses explicit from/to instead.
export const WINDOW_HOURS: Record<string, number> = { '24h': 24, '7d': 168, '30d': 720 };

// Bare YYYY-MM-DD → inclusive UTC day bound.
export function dayBound(v: string | undefined, end: boolean): string | undefined {
  if (!v) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${end ? '23:59:59' : '00:00:00'}Z` : v;
}
