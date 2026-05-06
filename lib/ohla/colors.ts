/**
 * Ohla dashboard palette — sampled from the PBIX report screenshots.
 *
 * Colors are locked to specific categories rather than palette-indexed, so
 * the same "FAQ Matched" slice looks identical in every visual that
 * references it (donut legend, stacked bar layer, line chart series).
 */

export const OHLA_PALETTE = {
    // Behaviour Distribution donut + stacked-bar stack layers (User Ask Analysis)
    faqMatched: '#0EA5E9', // light blue — biggest slice (57.83%)
    actionChainMatched: '#1E3A8A', // dark blue
    interaction: '#F97316', // orange
    irrelevant: '#7C3AED', // purple
    unmatchedAnywhere: '#EC4899', // pink — Other Case donut only

    // Match Rate trend lines (User Ask Analysis bottom combo)
    faqMatchRateLine: '#EAB308', // yellow
    overallMatchRateLine: '#EF4444', // red

    // Auto Support vs Total Ask combo (Overview)
    ohlaAutoSupport: '#1E3A8A', // dark blue column (Auto, sits on top)
    liveAgentSupport: '#38BDF8', // light blue column (Live, base)
    autoPctLine: '#F97316', // orange line

    // Single-metric trends
    agentSupportTrend: '#38BDF8', // light blue (Agent Support Daily Trend)

    // Special text color — PBIX shows Avg Rate in green
    avgRateGreen: '#16A34A',
} as const

export type OhlaPaletteKey = keyof typeof OHLA_PALETTE
