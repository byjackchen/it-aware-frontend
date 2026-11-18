/**
 * An external task's page: the app's own interface, framed from IT-Aware's origin
 * (lib/external/gateway.ts). IT-Aware decided the person has the task; inside the
 * frame, the app shows what the person's role there allows, or tells them they
 * have no access yet. Before the frame, an environment without the app set up, or
 * the app down, is said in words; a down app's own address, where the deployment
 * names one, is offered as a link.
 */

import { getTranslations } from 'next-intl/server';
import { frameSrc, openAddresses, taskState, type ExternalApp } from '@/lib/external/gateway';

export async function ExternalTaskPage({ app }: { app: ExternalApp }) {
  const state = await taskState(app);
  const t = await getTranslations('ExternalTask');
  if (state !== 'ready') {
    const address = state === 'unavailable' ? openAddresses()[app.code] : undefined;
    return (
      <div className="mx-auto max-w-[1320px] p-4">
        <p className="text-sm text-ink-2" data-testid="external-task-state">
          {t(state === 'not_configured' ? 'notConfigured' : 'unavailable', { name: app.name })}
          {address && (
            <>
              {' '}
              <a href={address} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline" data-testid="external-task-open">
                {t('openDirectly', { name: app.name })}
              </a>
            </>
          )}
        </p>
      </div>
    );
  }
  // The app's interface takes everything under the top bar: whose page it is
  // is said by the app mark on the task's name (components/tasks/TaskFrame.tsx).
  return (
    <iframe
      src={frameSrc(app)}
      title={app.name}
      className="block h-[calc(100vh-4rem-var(--env-banner-h,0px))] w-full border-0"
      data-testid="external-task-frame"
    />
  );
}
