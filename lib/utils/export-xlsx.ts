import { utils as xlsxUtils, write } from 'xlsx';

export function downloadXlsx(
    sheetName: string,
    headers: string[],
    rows: (string | number | null)[][],
    filename: string
) {
    const wb = xlsxUtils.book_new();
    const ws = xlsxUtils.aoa_to_sheet([headers, ...rows]);
    xlsxUtils.book_append_sheet(wb, ws, sheetName);
    const buf = write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([new Uint8Array(buf)], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
