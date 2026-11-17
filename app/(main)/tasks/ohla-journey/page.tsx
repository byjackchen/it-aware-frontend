/** The ohla-journey task: the app's own interface, framed (components/tasks/ExternalTaskPage.tsx). */

import { ExternalTaskPage } from '@/components/tasks/ExternalTaskPage';
import { EXTERNAL_APPS } from '@/lib/external/gateway';

export const dynamic = 'force-dynamic';

export default function OhlaJourneyPage() {
  return <ExternalTaskPage app={EXTERNAL_APPS['ohla-journey']} />;
}
