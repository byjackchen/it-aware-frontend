'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Scenario, GlobalEdge, Worker } from '@/lib/types/objects';

export interface ScenarioWithEdges extends Scenario {
    connectedEdges: GlobalEdge[];
}

interface UsePersonaScenariosResult {
    scenarios: ScenarioWithEdges[];
    isLoading: boolean;
    error: string | null;
}

async function fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url} (${response.status})`);
    }
    return response.json() as Promise<T>;
}

export function usePersonaScenarios(worker: Worker): UsePersonaScenariosResult {
    const [scenarios, setScenarios] = useState<ScenarioWithEdges[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cacheKey = useMemo(() => worker.oid, [worker.oid]);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setError(null);

            try {
                const listResponse = await fetchJson<{ items: Scenario[] }>(
                    `/api/objects/scenarios?worker_oid=${encodeURIComponent(worker.oid)}&limit=100`
                );
                const items = listResponse.items || [];

                if (cancelled) return;

                const withEdges: ScenarioWithEdges[] = await Promise.all(
                    items.map(async (scenario) => {
                        try {
                            const edgesResponse = await fetchJson<{ items: GlobalEdge[] }>(
                                `/api/edges/connected/${encodeURIComponent(scenario.oid)}?include_objects=true`
                            );
                            return { ...scenario, connectedEdges: edgesResponse.items || [] };
                        } catch {
                            return { ...scenario, connectedEdges: [] };
                        }
                    })
                );

                if (!cancelled) {
                    setScenarios(withEdges);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Failed to load scenarios');
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [cacheKey, worker.oid]);

    return { scenarios, isLoading, error };
}
