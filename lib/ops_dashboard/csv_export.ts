/**
 * CSV export helper for Ops Dashboard tables.
 *
 * Converts a set of rows + column definitions into a CSV blob and
 * triggers a browser download. Export always reflects the **currently
 * visible / filtered** rows the caller passes in — the table is in
 * charge of applying filters, sorts, and tab-level narrowing before
 * calling `downloadCsv`.
 *
 * Rules:
 *  - Cell values coerced to string; null / undefined → "".
 *  - Quotes are doubled ("""") per RFC 4180; values containing
 *    commas, quotes, newlines, or leading/trailing whitespace are
 *    wrapped in double quotes.
 *  - Leading `=` / `+` / `-` / `@` prefixed with `'` to defuse
 *    spreadsheet formula injection (CSV injection attack).
 *  - UTF-8 BOM (\ufeff) prepended so Excel opens the file as UTF-8
 *    (without BOM, Excel assumes local ANSI and mangles Chinese /
 *    accented characters).
 */

export interface CsvColumn<T> {
    /** Column header shown in the CSV. */
    label: string;
    /** Value extractor — returns the raw value, not a React node. */
    getValue: (row: T) => string | number | boolean | null | undefined;
}

function escapeCell(v: string | number | boolean | null | undefined): string {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'string' ? v : String(v);
    // CSV injection defense — leading control chars.
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) {
        s = `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

/**
 * Serialize rows + columns into a CSV string.
 * Mostly exposed for testing; callers normally use `downloadCsv`.
 */
export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
    const header = columns.map((c) => escapeCell(c.label)).join(',');
    const body = rows.map((r) =>
        columns.map((c) => escapeCell(c.getValue(r))).join(','),
    );
    // UTF-8 BOM so Excel reads Chinese / non-ASCII correctly.
    return '\ufeff' + [header, ...body].join('\r\n') + '\r\n';
}

/** Sanitize a filename fragment — strip characters that break on Windows. */
function sanitize(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'export';
}

/** Current timestamp suitable for filenames, e.g. `2026-05-11_161530`. */
function timestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
    );
}

/**
 * Trigger a browser download of the given rows as a CSV file.
 *
 * @param filenameStem  Base filename (without extension / timestamp).
 *                       Timestamp is appended automatically.
 * @param rows           Rows to export — typically the CURRENTLY
 *                       FILTERED + SORTED result.
 * @param columns        Column header + value extractor list.
 */
export function downloadCsv<T>(
    filenameStem: string,
    rows: T[],
    columns: CsvColumn<T>[],
): void {
    if (typeof window === 'undefined') return;
    const csv = rowsToCsv(rows, columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sanitize(filenameStem)}_${timestamp()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Release the blob URL after the click dispatches.
    setTimeout(() => URL.revokeObjectURL(url), 0);
}
