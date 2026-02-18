'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Worker } from '@/lib/types/objects';

interface WorkerListEnvelope {
    items: Worker[];
    total?: number;
    skip?: number;
    limit?: number;
}

interface UseAllActiveWorkersResult {
    workers: Worker[];
    isLoading: boolean;
    error: string | null;
    reload: () => Promise<void>;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

export function useAllActiveWorkers(): UseAllActiveWorkersResult {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadWorkers = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const allWorkers: Worker[] = [];
            const seen = new Set<string>();
            let skip = 0;
            let pageCount = 0;
            let total: number | null = null;

            while (pageCount < MAX_PAGES) {
                const response = await fetch(
                    `/api/objects/workers?is_active=true&limit=${PAGE_SIZE}&skip=${skip}`,
                    { cache: 'no-store' }
                );

                if (!response.ok) {
                    throw new Error(`Failed to load workers (${response.status})`);
                }

                const payload = (await response.json()) as WorkerListEnvelope;
                const pageItems = Array.isArray(payload.items) ? payload.items : [];

                if (typeof payload.total === 'number' && Number.isFinite(payload.total)) {
                    total = payload.total;
                }

                for (const worker of pageItems) {
                    if (seen.has(worker.oid)) continue;
                    seen.add(worker.oid);
                    allWorkers.push(worker);
                }

                if (pageItems.length < PAGE_SIZE) {
                    break;
                }

                if (typeof total === 'number' && allWorkers.length >= total) {
                    break;
                }

                skip += PAGE_SIZE;
                pageCount += 1;
            }

            setWorkers(allWorkers);
        } catch (err) {
            setWorkers([]);
            setError(err instanceof Error ? err.message : 'Failed to load workers');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadWorkers();
    }, [loadWorkers]);

    return {
        workers,
        isLoading,
        error,
        reload: loadWorkers,
    };
}
