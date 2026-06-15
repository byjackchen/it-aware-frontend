import { getModels, getRoutes, getTaskKeys } from '@/lib/api/systems';
import { RoutesClient } from './RoutesClient';

export default async function SystemsRoutesPage() {
  const [routes, models, taskKeys] = await Promise.all([getRoutes(), getModels(), getTaskKeys()]);
  return <RoutesClient routes={routes} models={models} taskKeys={taskKeys} />;
}
