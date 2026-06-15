import { getModels } from '@/lib/api/systems';
import { ModelsClient } from './ModelsClient';

export default async function SystemsModelsPage() {
  const models = await getModels();
  return <ModelsClient models={models} />;
}
