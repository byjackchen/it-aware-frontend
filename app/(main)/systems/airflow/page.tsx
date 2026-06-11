import { getAirflowDags } from '@/lib/api/systems';
import { AirflowClient } from './AirflowClient';

// Always fetch fresh DAG status on load (and on router.refresh()).
export const dynamic = 'force-dynamic';

export default async function SystemsAirflowPage() {
  const data = await getAirflowDags();
  return <AirflowClient data={data} />;
}
