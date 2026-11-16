'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Notice, tdClass, thClass, When } from '@/app/(main)/tasks/jobs/parts';
import { cell, withQuery } from '@/lib/data-tasks/view';
import type { RawRecords } from '@/lib/types/data-tasks';

interface RawRecordsViewProps {
  view: string;
  read: { ok: true; data: RawRecords } | { ok: false; message: string };
  keyFilter: string | null;
  /** This is a later page (the address carries a cursor). */
  paged: boolean;
}

/** One raw source's records: a column per field its reader names, newest first. */
export function RawRecordsView({ view, read, keyFilter, paged }: RawRecordsViewProps) {
  const t = useTranslations('DataTasks.raw');
  const path = `/tasks/raw-records/${view}`;
  const linkClass = 'rounded-lg px-3 py-1 text-sm text-accent hover:bg-hover';
  return (
    <div className="p-4">
      <div className="glass-card space-y-3 rounded-xl p-4">
        <p className="text-sm text-ink-2">{t('intro')}</p>
        <form method="get" action={path} className="flex gap-2">
          <input
            name="key"
            defaultValue={keyFilter ?? ''}
            placeholder={t('keyPlaceholder')}
            aria-label={t('key')}
            className="w-64 rounded-lg border border-line bg-field px-3 py-1.5 text-sm text-ink"
          />
          <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm text-page">
            {t('search')}
          </button>
        </form>
        {!read.ok ? (
          <Notice tone="error">{t('loadFailed', { message: read.message })}</Notice>
        ) : (
          <>
            <p className="text-sm text-ink" data-testid="raw-total">
              {t('total', { total: read.data.total, source: read.data.source })}
            </p>
            {read.data.items.length === 0 ? (
              <p className="py-8 text-center text-muted">{t('empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="raw-table">
                  <thead>
                    <tr className="border-b border-line">
                      <th className={thClass}>{t('columns.key')}</th>
                      <th className={thClass}>{t('columns.received')}</th>
                      {read.data.fields.map((field) => (
                        <th key={field} className={`${thClass} font-mono normal-case`}>{field}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {read.data.items.map((record) => (
                      <tr key={record.source_key} className="hover:bg-hover" data-testid="raw-row">
                        <td className={`${tdClass} font-mono text-xs`}>{record.source_key}</td>
                        <td className={`${tdClass} whitespace-nowrap text-ink-2`}><When iso={record.received_at} /></td>
                        {record.fields === null ? (
                          <td className={`${tdClass} italic text-muted`} colSpan={read.data.fields.length}>
                            {t('deleted')}
                          </td>
                        ) : (
                          read.data.fields.map((field) => (
                            <td
                              key={field}
                              className={`${tdClass} max-w-xs truncate font-mono text-xs`}
                              title={cell(record.fields?.[field])}
                            >
                              {cell(record.fields?.[field])}
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end gap-2">
              {paged && (
                <Link className={linkClass} href={withQuery(path, { key: keyFilter })}>{t('first')}</Link>
              )}
              {read.data.next_cursor && (
                <Link
                  className={linkClass}
                  href={withQuery(path, { key: keyFilter, cursor: read.data.next_cursor })}
                  data-testid="raw-next"
                >
                  {t('next')}
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
