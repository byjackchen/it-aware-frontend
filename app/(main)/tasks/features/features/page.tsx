/**
 * Manage Features, Features: every feature, or one (`?feature=<code>`), with its
 * phase, flags, gates and history (lib/features/view.ts). A person without
 * `systems:features:read` goes to the no-access page (read).
 */

import { getFeature, listFeatures, read } from '@/lib/api/features';
import { parseFeaturesView } from '@/lib/features/view';
import { LoadFailure } from '../../jobs/parts';
import { FeaturesList } from '../FeaturesList';
import { FeatureView } from '../FeatureView';
import { FeaturesFrame } from '../parts';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ManageFeaturesPage({ searchParams }: PageProps) {
  const { feature } = parseFeaturesView(await searchParams);
  if (feature) {
    const detail = await read(() => getFeature(feature));
    return (
      <FeaturesFrame>
        {detail.ok ? <FeatureView feature={detail.data} /> : <LoadFailure failure={detail.failure} />}
      </FeaturesFrame>
    );
  }
  const list = await read(listFeatures);
  return <FeaturesFrame>{list.ok ? <FeaturesList data={list.data} /> : <LoadFailure failure={list.failure} />}</FeaturesFrame>;
}
