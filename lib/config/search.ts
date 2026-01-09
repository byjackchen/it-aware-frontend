/**
 * Search configuration for global search feature.
 * Maps object types to their routes and icons.
 */

import { Building2, MapPin, User, Ticket, Layers } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ObjectTypeConfig {
    route: string;
    icon: LucideIcon;
    labelKey: string;
}

export const SEARCH_CONFIG: Record<string, ObjectTypeConfig> = {
    organization: {
        route: '/data/organizations',
        icon: Building2,
        labelKey: 'organizations',
    },
    location: {
        route: '/data/locations',
        icon: MapPin,
        labelKey: 'locations',
    },
    worker: {
        route: '/data/workers',
        icon: User,
        labelKey: 'workers',
    },
    ticket: {
        route: '/data/tickets',
        icon: Ticket,
        labelKey: 'tickets',
    },
    service_catalog: {
        route: '/data/service-catalogs',
        icon: Layers,
        labelKey: 'serviceCatalogs',
    },
};

/**
 * Get the detail page URL for an object.
 */
export function getObjectDetailUrl(objectType: string, oid: string): string {
    const config = SEARCH_CONFIG[objectType];
    if (!config) {
        console.warn(`Unknown object type: ${objectType}`);
        return '#';
    }
    return `${config.route}/${oid}`;
}
