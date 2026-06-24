import {
  getUsage,
  getUsageAggregate,
  getRoutes,
  getModels,
  type UsageFilters,
} from '@/lib/api/systems';
import { UsageClient } from './UsageClient';
import { WINDOW_HOURS, dayBound } from './filters';

export default async function SystemsUsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

  const win = one(sp.window) ?? '7d';
  const task_key = one(sp.task_key);
  const model_name = one(sp.model);
  const status = one(sp.status);
  const from = one(sp.from);
  const to = one(sp.to);

  const filters: UsageFilters =
    win === 'custom'
      ? {
          task_key,
          model_name,
          status,
          created_from: dayBound(from, false),
          created_to: dayBound(to, true),
        }
      : { task_key, model_name, status, window_hours: WINDOW_HOURS[win] ?? 168 };

  const [usage, aggregate, routes, models] = await Promise.all([
    getUsage({ ...filters, limit: 100 }),
    getUsageAggregate(filters),
    getRoutes(),
    getModels(),
  ]);

  const taskKeys = Array.from(new Set(routes.map((r) => r.task_key))).sort();
  const modelNames = Array.from(new Set(models.map((m) => m.name))).sort();

  return (
    <UsageClient
      usage={usage}
      aggregate={aggregate}
      taskKeys={taskKeys}
      models={modelNames}
      current={{ window: win, task_key, model: model_name, status, from, to }}
    />
  );
}
