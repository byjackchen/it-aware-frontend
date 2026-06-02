import { getModels, getRoutes } from '@/lib/api/systems';
import { RoutesClient } from './RoutesClient';

export default async function SystemsRoutesPage() {
  const [routes, models] = await Promise.all([getRoutes(), getModels()]);
  return <RoutesClient routes={routes} models={models} />;
}
