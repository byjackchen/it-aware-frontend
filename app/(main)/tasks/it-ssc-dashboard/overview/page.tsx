import { getWorkers, getServiceCatalogs } from '@/lib/api/objects';
import type { WorkerContext } from '@/lib/types/objects';
import { SSCDashboardPage } from './SSCDashboardPage';

export default async function SSCDashboardRoute() {
    // Fetch lookup data server-side (has auth cookies, auto-paginates)
    const workerMap: Record<string, WorkerContext> = {};
    const catalogMap: Record<string, string> = {};

    try {
        const workers = await getWorkers();
        console.log(`[SSC] Loaded ${workers.length} workers for lookup`);
        for (const w of workers) {
            workerMap[w.oid] = {
                stable_id: w.stable_id,
                region: w.region_name ?? null,
                country: w.country_name ?? null,
                department: w.department_name ?? null,
            };
        }
    } catch (e) {
        console.error('[SSC] Workers lookup failed:', e instanceof Error ? e.message : e);
    }

    try {
        const catalogs = await getServiceCatalogs();
        console.log(`[SSC] Loaded ${catalogs.length} catalogs for lookup`);
        for (const sc of catalogs) catalogMap[sc.oid] = sc.name;
    } catch (e) {
        console.error('[SSC] Catalogs lookup failed:', e instanceof Error ? e.message : e);
    }

    console.log(`[SSC] workerMap size: ${Object.keys(workerMap).length}, catalogMap size: ${Object.keys(catalogMap).length}`);

    return (
        <SSCDashboardPage
            initialWorkerMap={workerMap}
            initialCatalogMap={catalogMap}
        />
    );
}
