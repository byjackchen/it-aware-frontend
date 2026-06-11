import { getUsage, getUsageAggregate } from '@/lib/api/systems';
import { UsageClient } from './UsageClient';

export default async function SystemsUsagePage() {
  const [usage, aggregate] = await Promise.all([
    getUsage({ limit: 100 }),
    getUsageAggregate(),
  ]);
  return <UsageClient usage={usage} aggregate={aggregate} />;
}
