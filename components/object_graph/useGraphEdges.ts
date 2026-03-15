'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { GlobalEdge } from '@/lib/types/objects';
import type { EffectiveAtRange } from './types';

interface UseGraphEdgesParams {
    oid: string;
    initialEdges: GlobalEdge[];
    effectiveAtRange: EffectiveAtRange | null;
    selectedFilter: string | null;
}

interface UseGraphEdgesResult {
    edges: GlobalEdge[];
    allEdges: GlobalEdge[];
    linkedObjectTypes: string[];
    isLoading: boolean;
    error: string | null;
    effectiveAtBounds: { min: Date; max: Date } | null;
}

export function useGraphEdges({
    oid,
    initialEdges,
    effectiveAtRange,
    selectedFilter,
}: UseGraphEdgesParams): UseGraphEdgesResult {
    const [fetchedEdges, setFetchedEdges] = useState<GlobalEdge[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Base edges: fetched if range changed, otherwise initial
    const baseEdges = fetchedEdges ?? initialEdges;

    // Compute effective_at bounds from initial edges
    const effectiveAtBounds = useMemo(() => {
        const dates: number[] = [];
        initialEdges.forEach((e) => {
            if (e.effective_at) {
                const t = Date.parse(e.effective_at);
                if (!Number.isNaN(t)) dates.push(t);
            }
        });
        if (dates.length === 0) return null;
        return { min: new Date(Math.min(...dates)), max: new Date(Math.max(...dates)) };
    }, [initialEdges]);

    // Compute linked object types from all (unfiltered) base edges
    const linkedObjectTypes = useMemo(() => {
        const types = new Set<string>();
        baseEdges.forEach((edge) => {
            const obj = edge.from_oid === oid ? edge.to_object : edge.from_object;
            if (obj) types.add(obj.object_type);
        });
        return Array.from(types).sort();
    }, [baseEdges, oid]);

    // Apply type filter locally
    const edges = useMemo(() => {
        if (!selectedFilter) return baseEdges;
        return baseEdges.filter((edge) => {
            const obj = edge.from_oid === oid ? edge.to_object : edge.from_object;
            return obj?.object_type === selectedFilter;
        });
    }, [baseEdges, selectedFilter, oid]);

    // Fetch edges when effectiveAtRange changes
    const fetchEdges = useCallback(async (range: EffectiveAtRange) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                include_objects: 'true',
                page_size: '100',
                effective_at_from: range.from.toISOString(),
                effective_at_to: range.to.toISOString(),
            });

            const response = await fetch(
                `/api/edges/connected/${encodeURIComponent(oid)}?${params.toString()}`,
                { signal: controller.signal }
            );

            if (!response.ok) {
                throw new Error(`Failed to fetch edges: ${response.status}`);
            }

            const data = await response.json();
            if (!controller.signal.aborted) {
                setFetchedEdges(data.items ?? []);
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') return;
            if (!controller.signal.aborted) {
                setError(err instanceof Error ? err.message : 'Failed to fetch edges');
            }
        } finally {
            if (!controller.signal.aborted) {
                setIsLoading(false);
            }
        }
    }, [oid]);

    useEffect(() => {
        if (!effectiveAtRange) {
            setFetchedEdges(null);
            setError(null);
            return;
        }

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchEdges(effectiveAtRange);
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [effectiveAtRange, fetchEdges]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    return {
        edges,
        allEdges: baseEdges,
        linkedObjectTypes,
        isLoading,
        error,
        effectiveAtBounds,
    };
}
