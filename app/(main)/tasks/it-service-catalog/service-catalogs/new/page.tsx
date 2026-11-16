/**
 * New Service Catalog page - Server component.
 */

import { getServiceCatalogs } from '@/lib/api/objects';
import { ServiceCatalogCreatePage } from './ServiceCatalogCreatePage';

export default async function NewServiceCatalogPage() {
    const serviceCatalogs = await getServiceCatalogs();

    return <ServiceCatalogCreatePage serviceCatalogs={serviceCatalogs} />;
}
