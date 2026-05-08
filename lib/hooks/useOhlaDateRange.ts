'use client'

/**
 * useOhlaDateRange — shared global date filter for every Ohla dashboard.
 *
 * All six Ohla dashboards (Overview / User Ask Analysis / Agent Support /
 * Other Case / Survey Details / Raw Data) read and write the same
 * `{from, to}` window. Changes propagate:
 *   - within the current tab via a module-level pub/sub (instant);
 *   - across tabs via the browser `storage` event;
 *   - across reloads via localStorage.
 *
 * The default window is the 1st of the current month → today.
 */

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'itaware.ohla.dateRange.v1'

export interface OhlaDateRange {
    from: string // YYYY-MM-DD
    to: string // YYYY-MM-DD
}

function todayLocalISO(): string {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
}

function firstOfMonthISO(): string {
    const d = new Date()
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}-01`
}

function defaultRange(): OhlaDateRange {
    return { from: firstOfMonthISO(), to: todayLocalISO() }
}

function readStored(): OhlaDateRange {
    if (typeof window === 'undefined') return defaultRange()
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return defaultRange()
        const parsed = JSON.parse(raw) as Partial<OhlaDateRange>
        if (
            parsed &&
            typeof parsed.from === 'string' &&
            typeof parsed.to === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(parsed.from) &&
            /^\d{4}-\d{2}-\d{2}$/.test(parsed.to)
        ) {
            return { from: parsed.from, to: parsed.to }
        }
    } catch {
        // fall through
    }
    return defaultRange()
}

// Module-level subscriber list so multiple useOhlaDateRange consumers in the
// same tab stay in sync without bouncing through the storage event.
type Listener = (r: OhlaDateRange) => void
const listeners = new Set<Listener>()
let current: OhlaDateRange | null = null

function broadcast(next: OhlaDateRange) {
    current = next
    for (const fn of listeners) fn(next)
}

export function useOhlaDateRange(): {
    range: OhlaDateRange
    setRange: (next: OhlaDateRange | ((prev: OhlaDateRange) => OhlaDateRange)) => void
    setFrom: (v: string) => void
    setTo: (v: string) => void
} {
    const [range, setRangeState] = useState<OhlaDateRange>(() => current ?? readStored())

    useEffect(() => {
        // Initial hydration in case SSR rendered defaults but localStorage has
        // a different stored window — replace once we mount on the client.
        if (current === null) current = readStored()
        if (current.from !== range.from || current.to !== range.to) {
            setRangeState(current)
        }

        const fn: Listener = (r) => setRangeState(r)
        listeners.add(fn)

        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY || !e.newValue) return
            try {
                const parsed = JSON.parse(e.newValue) as OhlaDateRange
                if (parsed?.from && parsed?.to) broadcast(parsed)
            } catch {
                // ignore
            }
        }
        window.addEventListener('storage', onStorage)
        return () => {
            listeners.delete(fn)
            window.removeEventListener('storage', onStorage)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const setRange = useCallback(
        (next: OhlaDateRange | ((prev: OhlaDateRange) => OhlaDateRange)) => {
            const resolved =
                typeof next === 'function'
                    ? (next as (p: OhlaDateRange) => OhlaDateRange)(current ?? range)
                    : next
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved))
            } catch {
                // ignore quota / privacy mode
            }
            broadcast(resolved)
        },
        [range],
    )

    const setFrom = useCallback((v: string) => setRange((r) => ({ ...r, from: v })), [setRange])
    const setTo = useCallback((v: string) => setRange((r) => ({ ...r, to: v })), [setRange])

    return { range, setRange, setFrom, setTo }
}
