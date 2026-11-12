/**
 * New Organization page - Server component.
 */

import { getOrganizations } from '@/lib/api/objects';
import { OrganizationCreatePage } from './OrganizationCreatePage';

export default async function NewOrganizationPage() {
    const organizations = await getOrganizations();

    return <OrganizationCreatePage organizations={organizations} />;
}
