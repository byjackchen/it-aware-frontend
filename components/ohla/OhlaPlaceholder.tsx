'use client'

/**
 * OhlaPlaceholder — shared placeholder card for all 6 Ohla sub-pages
 * while the full Power BI-equivalent implementation lands across
 * Phase A / B / C (see ohla-dashboard-plan.md).
 *
 * The sidebar section and routes are wired up first so Ops team can
 * see the structure; each placeholder tells the user which PBIX page
 * is being ported here, and links to the plan doc for the timeline.
 */

import { Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'

interface Props {
    /** i18n key under Sidebar.* for the page name (e.g. 'opsOhlaOverview'). */
    labelKey: string
    /** Short PBIX page name for developer / reviewer context. */
    pbixPage: string
    /** One-line summary of what will eventually render here. */
    summary: string
}

export function OhlaPlaceholder({ labelKey, pbixPage, summary }: Props) {
    const t = useTranslations('Sidebar')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const pageTitle = t(labelKey)

    const bg = isLight ? 'bg-slate-50' : 'bg-slate-900'
    const cardBg = isLight
        ? 'bg-white border-slate-200'
        : 'bg-white/5 border-white/10'
    const titleText = isLight ? 'text-slate-900' : 'text-gray-100'
    const subtitleText = isLight ? 'text-slate-500' : 'text-gray-400'
    const iconBg = isLight
        ? 'bg-indigo-100 text-indigo-600'
        : 'bg-indigo-500/20 text-indigo-400'
    const bodyText = isLight ? 'text-slate-700' : 'text-gray-300'
    const hintText = isLight ? 'text-slate-500' : 'text-gray-500'
    const codeBg = isLight
        ? 'bg-slate-100 text-slate-700'
        : 'bg-white/5 text-gray-300'

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${bg}`}>
            <div className="flex items-start gap-3 shrink-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
                    <Sparkles className="w-5 h-5" />
                </div>
                <div>
                    <h1 className={`text-2xl font-semibold ${titleText}`}>
                        Ohla · {pageTitle}
                    </h1>
                    <p className={`text-sm mt-0.5 ${subtitleText}`}>
                        Port of Power BI page{' '}
                        <code className={`px-1.5 py-0.5 rounded text-xs ${codeBg}`}>
                            {pbixPage}
                        </code>
                    </p>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
                <div
                    className={`max-w-2xl mx-auto mt-16 rounded-xl border p-6 ${cardBg}`}
                >
                    <div className={`text-base font-medium ${titleText}`}>
                        Coming soon
                    </div>
                    <p className={`text-sm mt-2 leading-relaxed ${bodyText}`}>
                        {summary}
                    </p>
                    <p className={`text-xs mt-4 ${hintText}`}>
                        Scaffold merged ahead of implementation so the Ops team
                        can see the planned navigation. Full dashboard lands in
                        a follow-up MR — see{' '}
                        <code className={`px-1.5 py-0.5 rounded ${codeBg}`}>
                            ohla-dashboard-plan.md
                        </code>
                        .
                    </p>
                </div>
            </div>
        </div>
    )
}
