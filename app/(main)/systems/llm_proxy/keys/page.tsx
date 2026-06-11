import { getKeys, getModels } from '@/lib/api/systems';
import { KeysClient } from './KeysClient';

export default async function SystemsKeysPage() {
  const [keys, models] = await Promise.all([getKeys(), getModels()]);
  return <KeysClient keys={keys} models={models} />;
}
