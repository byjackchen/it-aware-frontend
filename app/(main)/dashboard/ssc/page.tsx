import { getWorkers, getServiceCatalogs } from '@/lib/api/objects';
import { SSCDashboardPage } from './SSCDashboardPage';

export default async function SSCDashboardRoute() {
    // Fetch lookup data server-side (has auth cookies, auto-paginates)
    let workerMap: Record<string, string> = {};
    let catalogMap: Record<string, string> = {};

    try {
        const workers = await getWorkers();
        console.log(`[SSC] Loaded ${workers.length} workers for lookup`);
        for (const w of workers) workerMap[w.oid] = w.stable_id;
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
