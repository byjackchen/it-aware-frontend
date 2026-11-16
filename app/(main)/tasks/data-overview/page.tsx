/**
 * Data Overview: IT-Aware's tables by the layers of the target data model,
 * raw → derived → transactional (GET /data/layers). A read that fails is the
 * page's error (error.tsx).
 */

import { useTranslations } from 'next-intl';
import { getDataLayers } from '@/lib/api/data-layers';
import { getTasksMine } from '@/lib/api/tasks';
import { load } from '@/lib/api/usage';
import { LayerColumns } from './LayerColumns';

// The rows are counted fresh on every load.
export const dynamic = 'force-dynamic';

function Heading() {
  const t = useTranslations('Dashboard');
  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink">{t('title')}</h1>
      <p className="mt-1 text-sm text-ink-2">{t('layers.title')}</p>
    </div>
  );
}

export default async function DataOverviewPage() {
  // The person's tasks say which tables get a link; without them none does.
  const [layers, mine] = await Promise.all([load(getDataLayers), getTasksMine().catch(() => null)]);
  if (!layers.ok) throw new Error(layers.message);
  const held = mine ? mine.tasks.map(({ task }) => task) : null;
  return (
    <div className="mx-auto max-w-[1320px] space-y-4 p-4">
      <Heading />
      <LayerColumns data={layers.data} held={held} />
    </div>
  );
}
