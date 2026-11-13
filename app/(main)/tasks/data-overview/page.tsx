/**
 * Data Overview: the record counts of the main objects as a row of tiles, then
 * IT-Aware's tables by the layers of the target data model: raw → derived →
 * transactional (GET /data/layers). When the layers cannot be read, a notice
 * stands in their place and the tiles still show.
 */

import { getDataLayers } from '@/lib/api/data-layers';
import { getTasksMine } from '@/lib/api/tasks';
import { load } from '@/lib/api/usage';
import { LayerColumns, LayersFailure } from './LayerColumns';
import { ObjectStatsDashboard } from './ObjectStatsDashboard';

// The rows are counted fresh on every load.
export const dynamic = 'force-dynamic';

export default async function DataOverviewPage() {
  // The person's tasks say which tables get a link; without them none does.
  const [layers, mine] = await Promise.all([load(getDataLayers), getTasksMine().catch(() => null)]);
  const held = mine ? mine.tasks.map(({ task }) => task) : null;
  return (
    <div className="mx-auto max-w-[1320px] space-y-5 p-4">
      <ObjectStatsDashboard />
      {layers.ok ? <LayerColumns data={layers.data} held={held} /> : <LayersFailure message={layers.message} />}
    </div>
  );
}
