'use client';

/**
 * Survey Rate 1-5 range slider for the Survey Details page. Two HTML
 * native range inputs stacked so either end of the window can be moved
 * independently; clamps `min <= max`.
 */

import { useTheme } from '@/lib/contexts/theme-context'

export interface RangeSliderFilterProps {
    label: string
    min: number
    max: number
    step?: number
    value: [number, number]
    onChange: (next: [number, number]) => void
}

export function RangeSliderFilter({
    label,
    min,
    max,
    step = 1,
    value,
    onChange,
}: RangeSliderFilterProps) {
    const { theme } = useTheme()
    const isLight = theme === 'light'
    const labelCls = isLight ? 'text-slate-600' : 'text-gray-300'
    const numCls = isLight ? 'text-slate-800' : 'text-gray-100'

    const [lo, hi] = value

    return (
        <div className="flex items-center gap-2 text-xs">
            <span className={`${labelCls}`}>{label}</span>
            <span className={`${numCls} tabular-nums min-w-[1.5ch] text-right`}>{lo}</span>
            <div className="flex flex-col w-28">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={lo}
                    onChange={(e) => {
                        const n = Number(e.target.value)
                        onChange([Math.min(n, hi), hi])
                    }}
                    className="h-1 accent-sky-500"
                />
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={hi}
                    onChange={(e) => {
                        const n = Number(e.target.value)
                        onChange([lo, Math.max(n, lo)])
                    }}
                    className="h-1 accent-sky-500"
                />
            </div>
            <span className={`${numCls} tabular-nums min-w-[1.5ch]`}>{hi}</span>
        </div>
    )
}
