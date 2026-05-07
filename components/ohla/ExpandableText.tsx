'use client'

/**
 * ExpandableText — for long text fields in Ohla detail tables (response,
 * user content, ticket reason). Renders a click-to-toggle cell:
 *   - collapsed: first `maxChars` chars + ellipsis, full text in `title`
 *     so hover reveals it without expanding the row.
 *   - expanded: the full string wrapped over multiple lines, click to
 *     collapse again. Whitespace is preserved (for multi-line bot
 *     responses with line breaks).
 *
 * If the string is null/empty we render the placeholder dash.
 */

import { useState } from 'react'

export interface ExpandableTextProps {
    text: string | null | undefined
    /** Char threshold above which the text is collapsed by default. */
    maxChars?: number
    placeholder?: string
}

export function ExpandableText({
    text,
    maxChars = 80,
    placeholder = '—',
}: ExpandableTextProps) {
    const [open, setOpen] = useState(false)

    if (text == null || text === '') {
        return <span className="text-slate-400">{placeholder}</span>
    }

    const s = String(text)
    if (s.length <= maxChars) {
        return <span className="whitespace-pre-wrap break-words">{s}</span>
    }

    if (open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-left whitespace-pre-wrap break-words hover:underline focus:outline-none w-full max-w-[480px] cursor-zoom-out"
                title="Click to collapse"
            >
                {s}
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-left truncate hover:underline focus:outline-none w-full max-w-[280px] cursor-zoom-in"
            title={s}
        >
            {s.slice(0, maxChars)}…
        </button>
    )
}
