'use client';

/**
 * Two flow-state sections for the Interaction detail page:
 *
 *  1. <EventTrackingSection> — structured, read-only render of the chatbot
 *     event_tracking trace that the sync persisted inside
 *     content_raw.record.flow_states.event_tracking (timing + chatbot_answers +
 *     relevant_sources). Also surfaces the react/response/cycle_seconds columns.
 *
 *  2. <ReactSection> — fetch-on-demand. A "Fetch ReAct" button calls
 *     GET /api/objects/interactions/<oid>/react-data, which proxies the live
 *     single-chats export (include_flowstates=["react"]) for this cycle, then
 *     renders the ReAct process_chain in a formatted, step-by-step way.
 */

import { useState } from 'react';
import { Activity, Brain, Loader2, Timer } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Interaction } from '@/lib/types/objects';

// ── shared helpers ───────────────────────────────────────────────────────────

function fmtSec(v: number | null | undefined): string {
    return v === null || v === undefined ? '—' : `${v.toFixed(3)}s`;
}

function asArray(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
}

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
}

/** Pull content_raw.record.flow_states.event_tracking[] from an interaction. */
function getEventTracking(interaction: Interaction): unknown[] {
    const cr = asRecord(interaction.content_raw);
    const record = asRecord(cr?.record);
    const flowStates = asRecord(record?.flow_states);
    return asArray(flowStates?.event_tracking);
}

interface SectionTheme {
    cardCls: string;
    headingCls: string;
    labelCls: string;
    chipCls: string;
    preCls: string;
    subtleBox: string;
}

function useSectionTheme(): { isLight: boolean } & SectionTheme {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    return {
        isLight,
        cardCls: isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5',
        headingCls: isLight ? 'text-slate-700' : 'text-gray-200',
        labelCls: 'text-xs font-semibold opacity-60 uppercase tracking-wider mb-1',
        chipCls: isLight
            ? 'bg-slate-100 text-slate-700 border-slate-200'
            : 'bg-white/10 text-gray-200 border-white/10',
        preCls: isLight ? 'text-slate-700' : 'text-gray-300',
        subtleBox: isLight ? 'bg-slate-50' : 'bg-black/20',
    };
}

// ── 1. Event Tracking ─────────────────────────────────────────────────────────

export function EventTrackingSection({ interaction }: { interaction: Interaction }) {
    const t = useSectionTheme();
    const entries = getEventTracking(interaction);

    // Split the trace into its known entry kinds.
    let timing: Record<string, unknown> | null = null;
    const answers: unknown[] = [];
    const sources: unknown[] = [];
    const others: unknown[] = [];
    for (const entry of entries) {
        const rec = asRecord(entry);
        if (!rec) {
            others.push(entry);
            continue;
        }
        if (rec.timing && asRecord(rec.timing)) {
            timing = asRecord(rec.timing);
        } else if ('chatbot_answers' in rec) {
            answers.push(...asArray(rec.chatbot_answers));
        } else if ('relevant_sources' in rec) {
            sources.push(...asArray(rec.relevant_sources));
        } else {
            others.push(rec);
        }
    }

    const hasColumns =
        interaction.react_seconds != null ||
        interaction.response_seconds != null ||
        interaction.cycle_seconds != null;

    return (
        <div className={`rounded-xl border p-6 space-y-5 ${t.cardCls}`}>
            <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 opacity-70" />
                <h3 className={`text-sm font-semibold ${t.headingCls}`}>Event Tracking</h3>
            </div>

            {/* Timing — prefer stored columns, fall back to the raw timing entry */}
            <div>
                <span className={`block ${t.labelCls}`}>Timing</span>
                {hasColumns || timing ? (
                    <div className="flex flex-wrap gap-2">
                        {[
                            ['React', interaction.react_seconds ?? (timing?.react_seconds as number | undefined)],
                            ['Response', interaction.response_seconds ?? (timing?.response_seconds as number | undefined)],
                            ['Cycle', interaction.cycle_seconds ?? (timing?.cycle_seconds as number | undefined)],
                        ].map(([label, val]) => (
                            <span
                                key={label as string}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${t.chipCls}`}
                            >
                                <Timer className="w-3 h-3 opacity-70" />
                                <span className="opacity-60">{label as string}</span>
                                <span className="font-mono font-semibold">{fmtSec(val as number | null | undefined)}</span>
                            </span>
                        ))}
                    </div>
                ) : (
                    <span className="text-sm italic opacity-50">No timing recorded for this cycle</span>
                )}
            </div>

            {/* Chatbot answers */}
            <div>
                <span className={`block ${t.labelCls}`}>Chatbot Answers ({answers.length})</span>
                {answers.length === 0 ? (
                    <span className="text-sm italic opacity-50">—</span>
                ) : (
                    <ol className="space-y-2 list-decimal list-inside">
                        {answers.map((ans, i) => {
                            const rec = asRecord(ans);
                            if (rec) {
                                // media reference (base64 stripped to byte count by sync)
                                const name = (rec.media_name as string) ?? 'media';
                                const bytes = rec.media_base64_bytes as number | undefined;
                                return (
                                    <li key={i} className="text-sm">
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs ${t.chipCls}`}>
                                            📎 {name}
                                            {bytes != null && <span className="opacity-60">({bytes.toLocaleString()} B)</span>}
                                        </span>
                                    </li>
                                );
                            }
                            return (
                                <li key={i} className="text-sm">
                                    <div className={`inline-block p-2 rounded-lg whitespace-pre-wrap align-top ${t.subtleBox} ${t.preCls}`}>
                                        {String(ans)}
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>

            {/* Relevant sources */}
            <div>
                <span className={`block ${t.labelCls}`}>Relevant Sources ({sources.length})</span>
                {sources.length === 0 ? (
                    <span className="text-sm italic opacity-50">—</span>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {sources.map((src, i) => {
                            const rec = asRecord(src);
                            const name = (rec?.action_name as string) ?? JSON.stringify(src);
                            return (
                                <span key={i} className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-xs font-mono ${t.chipCls}`}>
                                    {name}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>

            {others.length > 0 && (
                <div>
                    <span className={`block ${t.labelCls}`}>Other Entries ({others.length})</span>
                    <div className={`p-3 rounded-lg overflow-x-auto ${t.subtleBox}`}>
                        <pre className={`text-xs font-mono ${t.preCls}`}>{JSON.stringify(others, null, 2)}</pre>
                    </div>
                </div>
            )}

            {entries.length === 0 && (
                <p className="text-sm italic opacity-50">
                    No event_tracking trace stored for this interaction.
                </p>
            )}
        </div>
    );
}

// ── 2. ReAct (fetch on demand) ─────────────────────────────────────────────────

interface ReactDataResponse {
    cycle_id: string;
    found: boolean;
    react: Record<string, unknown> | null;
    rounds_count: number | null;
}

function ProcessChainStep({ step, index, isLight }: { step: unknown; index: number; isLight: boolean }) {
    const rec = asRecord(step);
    const boxCls = isLight ? 'bg-slate-50 border-slate-200' : 'bg-black/20 border-white/10';
    if (!rec) {
        return (
            <li className={`p-3 rounded-lg border ${boxCls}`}>
                <pre className={`text-xs font-mono whitespace-pre-wrap ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{String(step)}</pre>
            </li>
        );
    }
    return (
        <li className={`p-3 rounded-lg border ${boxCls}`}>
            <div className="flex items-center gap-2 mb-2">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-300'}`}>
                    {index + 1}
                </span>
                <span className="text-xs font-semibold opacity-60 uppercase tracking-wider">
                    {Object.keys(rec).join(' · ')}
                </span>
            </div>
            <div className="space-y-2">
                {Object.entries(rec).map(([key, val]) => (
                    <div key={key}>
                        <span className="block text-[10px] font-semibold opacity-50 uppercase tracking-wider mb-0.5">{key}</span>
                        <div className={`text-xs whitespace-pre-wrap ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            {typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
                        </div>
                    </div>
                ))}
            </div>
        </li>
    );
}

export function ReactSection({ interaction }: { interaction: Interaction }) {
    const t = useSectionTheme();
    const { isLight } = t;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ReactDataResponse | null>(null);

    // Recover the chatbot cycle_id (content_raw.cycle_id, else stable_id without
    // any "ns:" prefix) and the owning user (actor_stable_id) for the gateway call.
    const cycleId = (() => {
        const cr = asRecord(interaction.content_raw);
        const cid = cr?.cycle_id;
        if (typeof cid === 'string' && cid.trim()) return cid.trim();
        const sid = interaction.stable_id ?? '';
        return sid.includes(':') ? sid.split(':').slice(1).join(':') : sid;
    })();

    const fetchReact = async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ cycle_id: cycleId });
            if (interaction.actor_stable_id) params.set('user_id', interaction.actor_stable_id);
            const res = await fetch(`/api/services/chatbot/react?${params.toString()}`, {
                credentials: 'include',
                cache: 'no-store',
            });
            if (!res.ok) {
                const body = await res.text().catch(() => '');
                throw new Error(`Fetch failed (${res.status}): ${body.slice(0, 200)}`);
            }
            setData((await res.json()) as ReactDataResponse);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    };

    const react = data?.react ?? null;
    const processChain = asArray(react?.process_chain);
    const availableTools = asArray(react?.available_tools);
    // Render any non-process_chain/available_tools react keys as a compact summary.
    const extraKeys = react
        ? Object.keys(react).filter((k) => k !== 'process_chain' && k !== 'available_tools')
        : [];

    return (
        <div className={`rounded-xl border p-6 space-y-5 ${t.cardCls}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 opacity-70" />
                    <h3 className={`text-sm font-semibold ${t.headingCls}`}>ReAct Agent Observation</h3>
                </div>
                <button
                    onClick={fetchReact}
                    disabled={loading}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors disabled:opacity-50 ${
                        isLight
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                            : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20'
                    }`}
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    <span>{data ? 'Re-fetch ReAct' : 'Fetch ReAct'}</span>
                </button>
            </div>

            <p className="text-xs opacity-50">
                Fetches the live chatbot cycle with <span className="font-mono">flow_states.react</span> on
                demand. Heavy reasoning data is not stored — it is retrieved only when requested.
            </p>

            {error && (
                <div className={`rounded-lg border p-3 text-xs ${isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                    ⚠️ {error}
                </div>
            )}

            {data && !data.found && !error && (
                <p className="text-sm italic opacity-50">
                    No ReAct data returned for cycle <span className="font-mono">{data.cycle_id}</span>.
                </p>
            )}

            {react && (
                <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${t.chipCls}`}>
                            <span className="opacity-60">Cycle</span>
                            <span className="font-mono">{data?.cycle_id}</span>
                        </span>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${t.chipCls}`}>
                            <span className="opacity-60">Rounds</span>
                            <span className="font-mono font-semibold">{data?.rounds_count ?? 0}</span>
                        </span>
                        {availableTools.length > 0 && (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${t.chipCls}`}>
                                <span className="opacity-60">Tools</span>
                                <span className="font-mono font-semibold">{availableTools.length}</span>
                            </span>
                        )}
                    </div>

                    <div>
                        <span className={`block ${t.labelCls}`}>Process Chain ({processChain.length})</span>
                        {processChain.length === 0 ? (
                            <span className="text-sm italic opacity-50">Empty — no ReAct reasoning steps for this cycle.</span>
                        ) : (
                            <ol className="space-y-2">
                                {processChain.map((step, i) => (
                                    <ProcessChainStep key={i} step={step} index={i} isLight={isLight} />
                                ))}
                            </ol>
                        )}
                    </div>

                    {extraKeys.length > 0 && (
                        <details>
                            <summary className="text-xs font-semibold opacity-60 uppercase tracking-wider cursor-pointer">
                                Other ReAct fields ({extraKeys.join(', ')})
                            </summary>
                            <div className={`mt-2 p-3 rounded-lg overflow-x-auto ${t.subtleBox}`}>
                                <pre className={`text-xs font-mono ${t.preCls}`}>
                                    {JSON.stringify(
                                        Object.fromEntries(extraKeys.map((k) => [k, react[k]])),
                                        null,
                                        2,
                                    )}
                                </pre>
                            </div>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}
