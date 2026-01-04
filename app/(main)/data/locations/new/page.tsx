/**
 * New Location page - Server component.
 */

import { getLocations } from '@/lib/api/objects';
import { LocationCreatePage } from './LocationCreatePage';

export default async function NewLocationPage() {
    const locations = await getLocations();

    return <LocationCreatePage locations={locations} />;
}
