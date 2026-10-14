type Row = Record<string, unknown>;

export type JourneyStep = {
  unitId: string;
  unit: Row;
  requests: Row[];
  gapSeconds: number | null;
  joiningLinks: unknown[][];
};

export async function loadJourneyUnits(
  unitIds: string[],
  fetchUnit: (unitId: string) => Promise<Row>,
  concurrency = 8,
): Promise<{ units: Record<string, Row>; failedIds: string[] }> {
  const ids = [...new Set(unitIds)];
  const units: Record<string, Row> = {};
  const failedIds: string[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(ids.length, Math.max(1, Math.floor(concurrency))) }, async () => {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        units[id] = await fetchUnit(id);
      } catch {
        failedIds.push(id);
      }
    }
  }));
  return { units, failedIds };
}

export function buildJourneyTimeline(requests: Row[], units: Record<string, Row>, links: unknown[]): JourneyStep[] {
  const grouped = new Map<string, Row[]>();
  for (const request of [...requests].sort((a, b) => String(a.at).localeCompare(String(b.at)))) {
    const unitId = String(request.unit_id);
    grouped.set(unitId, [...(grouped.get(unitId) ?? []), request]);
  }
  const steps: JourneyStep[] = [];
  for (const [unitId, items] of grouped) {
    const previous = steps.at(-1);
    const currentTime = Date.parse(String(items[0].at));
    const previousTime = previous ? Date.parse(String(previous.requests[0].at)) : NaN;
    const difference = (currentTime - previousTime) / 1000;
    steps.push({
      unitId,
      unit: units[unitId] ?? {},
      requests: items,
      gapSeconds: previous && Number.isFinite(difference) && difference >= 0 ? difference : null,
      joiningLinks: previous ? links.filter((link): link is unknown[] => Array.isArray(link)
        && ((link[0] === previous.unitId && link[1] === unitId) || (link[1] === previous.unitId && link[0] === unitId))) : [],
    });
  }
  return steps;
}
