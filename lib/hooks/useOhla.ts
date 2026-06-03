'use client'

/**
 * Ohla chatbot dashboard data hook.
 *
 * Pulls all chatbot interactions for a given time window plus the full
 * active worker list (for region/country/VIP enrichment), then decodes
 * each interaction into the flat OhlaRow shape.
 *
 * Calls the `/api/objects/<resource>` Next.js proxy route that forwards
 * query params to the backend while injecting the `it_aware_access`
 * cookie server-side — keeps this module client-safe (no `next/headers`
 * import leaks into the bundle).
 *
 * In-memory cached by (from, to) so flipping back and forth between
 * sibling Ohla pages doesn't refetch.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Interaction, Worker } from '@/lib/types/objects'
import { buildWorkersLookup, decodeInteraction } from '@/lib/ohla/decode'
import type { OhlaRow } from '@/lib/ohla/types'

interface Options {
    /** ISO date-only (YYYY-MM-DD); interactions created ≥ this date. */
    from?: string | null
    /** ISO date-only; interactions created ≤ this date (inclusive). */
    to?: string | null
    enabled?: boolean
}

interface State {
    rows: OhlaRow[]
    loading: boolean
    error: string | null
    /** Fraction 0..1 of how much of the interaction paging has arrived. */
    progress: number
    refetch: () => Promise<void>
}

interface ListEnvelope<T> {
    items?: T[]
    total?: number | null
    skip?: number
    limit?: number
}

const PAGE_SIZE = 1000
const MAX_PAGES = 200 // 200k-row safety ceiling — backend caps limit at 1000/page;
                     // Jan-Apr 2026 has ~46k rows, so we need 46+ pages.

const interactionCache = new Map<string, Interaction[]>()
let workersPromise: Promise<Worker[]> | null = null

function cacheKey(from: string | null | undefined, to: string | null | undefined) {
    return `${from ?? ''}::${to ?? ''}`
}

async function fetchJson<T>(url: string): Promise<T> {
    const resp = await fetch(url, { cache: 'no-store' })
    if (!resp.ok) {
        if (resp.status === 401) throw new Error('Not authenticated')
        throw new Error(`Fetch failed: ${resp.status}`)
    }
    return (await resp.json()) as T
}

async function fetchAllInteractions(
    from: string | null | undefined,
    to: string | null | undefined,
): Promise<Interaction[]> {
    const all: Interaction[] = []
    for (let page = 0; page < MAX_PAGES; page += 1) {
        const params = new URLSearchParams()
        params.set('source_system', 'chatbot')
        params.set('skip', String(page * PAGE_SIZE))
        params.set('limit', String(PAGE_SIZE))
        params.set('sort_by', 'created_at')
        params.set('order', 'desc')
        if (from) params.set('created_at_from', `${from}T00:00:00.000Z`)
        if (to) params.set('created_at_to', `${to}T23:59:59.999Z`)
        const env = await fetchJson<ListEnvelope<Interaction>>(
            `/api/objects/interactions?${params.toString()}`,
        )
        const items = env.items ?? []
        all.push(...items)
        if (items.length < PAGE_SIZE) break
    }
    return all
}

async function fetchAllWorkers(): Promise<Worker[]> {
    const all: Worker[] = []
    for (let page = 0; page < MAX_PAGES; page += 1) {
        const params = new URLSearchParams()
        params.set('is_active', 'true')
        params.set('skip', String(page * PAGE_SIZE))
        params.set('limit', String(PAGE_SIZE))
        const env = await fetchJson<ListEnvelope<Worker>>(
            `/api/objects/workers?${params.toString()}`,
        )
        const items = env.items ?? []
        all.push(...items)
        if (items.length < PAGE_SIZE) break
    }
    return all
}

export function useOhla({ from, to, enabled = true }: Options = {}): State {
    const [state, setState] = useState<{
        rows: OhlaRow[]
        loading: boolean
        error: string | null
    }>({ rows: [], loading: enabled, error: null })

    const key = cacheKey(from, to)

    const load = useCallback(async () => {
        setState((s) => ({ ...s, loading: true, error: null }))
        try {
            const [interactionsRaw, workers] = await Promise.all([
                (async () => {
                    const cached = interactionCache.get(key)
                    if (cached) return cached
                    const fetched = await fetchAllInteractions(from, to)
                    interactionCache.set(key, fetched)
                    return fetched
                })(),
                (async () => {
                    if (!workersPromise) workersPromise = fetchAllWorkers()
                    return workersPromise
                })(),
            ])

            const workerMap = buildWorkersLookup(workers)
            const decoded = interactionsRaw.map((i) => decodeInteraction(i, workerMap))
            setState({ rows: decoded, loading: false, error: null })
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setState({ rows: [], loading: false, error: msg })
        }
    }, [key, from, to])

    useEffect(() => {
        if (!enabled) return
        void load()
    }, [enabled, load])

    return useMemo<State>(
        () => ({
            ...state,
            progress: state.loading ? 0.5 : 1,
            refetch: async () => {
                interactionCache.delete(key)
                workersPromise = null
                await load()
            },
        }),
        [state, load, key],
    )
}
