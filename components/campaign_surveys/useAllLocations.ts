'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Location } from '@/lib/types/objects';

interface LocationListEnvelope {
    items: Location[];
    total?: number;
    skip?: number;
    limit?: number;
}

interface UseAllLocationsResult {
    locations: Location[];
    isLoading: boolean;
    error: string | null;
    reload: () => Promise<void>;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

export function useAllLocations(): UseAllLocationsResult {
    const [locations, setLocations] = useState<Location[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadLocations = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const allLocations: Location[] = [];
            const seen = new Set<string>();
            let skip = 0;
            let pageCount = 0;
            let total: number | null = null;

            while (pageCount < MAX_PAGES) {
                // No is_active filter: worker.location_oid may reference deactivated sites;
                // we still want their names for display/export.
                const response = await fetch(
                    `/api/objects/locations?limit=${PAGE_SIZE}&skip=${skip}`,
                    { cache: 'no-store' }
                );

                if (!response.ok) {
                    throw new Error(`Failed to load locations (${response.status})`);
                }

                const payload = (await response.json()) as LocationListEnvelope;
                const pageItems = Array.isArray(payload.items) ? payload.items : [];

                if (typeof payload.total === 'number' && Number.isFinite(payload.total)) {
                    total = payload.total;
                }

                for (const loc of pageItems) {
                    if (seen.has(loc.oid)) continue;
                    seen.add(loc.oid);
                    allLocations.push(loc);
                }

                if (pageItems.length < PAGE_SIZE) {
                    break;
                }

                if (typeof total === 'number' && allLocations.length >= total) {
                    break;
                }

                skip += PAGE_SIZE;
                pageCount += 1;
            }

            setLocations(allLocations);
        } catch (err) {
            setLocations([]);
            setError(err instanceof Error ? err.message : 'Failed to load locations');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadLocations();
    }, [loadLocations]);

    return {
        locations,
        isLoading,
        error,
        reload: loadLocations,
    };
}
