/**
 * formatRelative — Slack/Twitter-style "2m ago" / "yesterday" timestamps.
 *
 * Returns a short string suitable for in-message timestamps. Falls back to
 * `toLocaleString()` for anything older than a week.
 */
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function formatRelative(input: string | Date | undefined | null): string {
    if (!input) return '';
    const date = typeof input === 'string' ? new Date(input) : input;
    const delta = Date.now() - date.getTime();
    if (delta < MIN) return 'just now';
    if (delta < HOUR) {
        const m = Math.floor(delta / MIN);
        return `${m}m ago`;
    }
    if (delta < DAY) {
        const h = Math.floor(delta / HOUR);
        return `${h}h ago`;
    }
    if (delta < 7 * DAY) {
        const d = Math.floor(delta / DAY);
        return d === 1 ? 'yesterday' : `${d}d ago`;
    }
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    });
}
