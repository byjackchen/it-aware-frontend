'use client';

/**
 * ClassifierCaveatFooter — small amber info badge explaining that the
 * Phase 1 catalog-vs-asset split is heuristic (client-side) and will be
 * replaced by a server-side `request_type` in Phase 2.
 *
 * Rendered on pages whose base filter relies on `classifyRequestType()`
 * (Catalog Task Dashboard, Aging SC Tasks, Aging Asset Tasks).
 */

import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';

export function ClassifierCaveatFooter() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const cls = isLight
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-amber-500/30 bg-amber-500/10 text-amber-300';

    return (
        <div
            className={`rounded-lg border px-3 py-2 text-[11px] flex items-start gap-2 ${cls}`}
            role="note"
        >
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{t('classifierCaveat')}</span>
        </div>
    );
}
