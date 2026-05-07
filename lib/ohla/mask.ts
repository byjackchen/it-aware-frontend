/**
 * Mask a WeCom ID for display in tables.
 *
 * Show first 2 and last 2 chars with `***` in the middle. Strings shorter
 * than 5 chars are returned unchanged (nothing useful to hide). Null /
 * empty stays as the placeholder dash.
 *
 *   "T30210037A"     → "T3*****7A"
 *   "william.luo"    → "wi*******uo"
 *   "v_zzzhangzz"    → "v_*******zz"
 *   ""               → "—"
 */
export function maskWecomId(raw: string | null | undefined): string {
    if (!raw) return '—'
    const s = String(raw)
    if (s.length <= 4) return s
    const head = s.slice(0, 2)
    const tail = s.slice(-2)
    const middle = '*'.repeat(Math.max(3, s.length - 4))
    return `${head}${middle}${tail}`
}
