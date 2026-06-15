'use client';

import { CircleHelp } from 'lucide-react';

interface FieldHintProps {
  /** Visible column label. */
  label: string;
  /** Definition shown on hover/focus of the question mark. */
  hint: string;
}

/**
 * A column-header label followed by a small "?" icon. Hovering (or focusing) the
 * icon reveals a themed definition bubble below it. `title` is kept as a native
 * fallback so the definition is still reachable if the bubble is clipped.
 */
export function FieldHint({ label, hint }: FieldHintProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <span
        className="group relative inline-flex cursor-help"
        tabIndex={0}
        aria-label={hint}
        title={hint}
      >
        <CircleHelp className="h-3.5 w-3.5 text-gray-500 transition-colors group-hover:text-gray-300 group-focus-within:text-gray-300" />
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 rounded-md border border-white/10 bg-gray-900 px-3 py-2 text-xs font-normal leading-snug text-gray-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
        >
          {hint}
        </span>
      </span>
    </span>
  );
}
