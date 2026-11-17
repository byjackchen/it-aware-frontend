/**
 * Ohla Router: Router's own management interface, framed from IT-Aware's origin
 * (lib/external/ohla-router.ts). IT-Aware decided the person has the task; inside
 * the frame, Router shows what the person's role there allows, or tells them
 * they have no access yet.
 */

import { getTranslations } from 'next-intl/server';
import { FRAME_SRC, routerState } from '@/lib/external/ohla-router';

export const dynamic = 'force-dynamic';

export default async function OhlaRouterPage() {
  const state = await routerState();
  const t = await getTranslations('OhlaRouter');
  if (state !== 'ready') {
    return (
      <div className="mx-auto max-w-[1320px] p-4">
        <p className="text-sm text-ink-2" data-testid="ohla-router-state">
          {t(state === 'not_configured' ? 'notConfigured' : 'unavailable')}
        </p>
      </div>
    );
  }
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-1 p-2">
      <p className="px-2 text-xs text-ink-2">{t('providedBy')}</p>
      <iframe src={FRAME_SRC} title={t('title')} className="w-full flex-1 rounded border border-line" data-testid="ohla-router-frame" />
    </div>
  );
}
