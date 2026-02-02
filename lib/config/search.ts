/**
 * Search configuration for global search feature.
 * Maps object types to their routes and icons.
 */

import { Building2, MapPin, User, Layers, FileText } from 'lucide-react';
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
    service_catalog: {
        route: '/data/service-catalogs',
        icon: Layers,
        labelKey: 'serviceCatalogs',
    },
    article: {
        route: '/data/articles',
        icon: FileText,
        labelKey: 'articles',
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
