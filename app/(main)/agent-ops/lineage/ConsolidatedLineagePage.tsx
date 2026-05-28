'use client';

/**
 * Consolidated Ticket Lineage (client).
 *
 * Renders a date-scoped FOREST of ticket lineage trees from
 * GET /tickets/lineage/consolidated, plus a side panel showing the selected
 * node's merged trace (GET /tickets/{oid}/trace). Same date filter mechanism as
 * the tickets list (seconds precision, timezone-aware; default past 1 week).
 * Each node hyperlinks to its ticket detail.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Network } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import {
    formatDateTime,
    formatLocalDateTime,
    localDateTimeToIso,
    formatTzBadge,
} from '@/lib/utils/datetime';
import type { TicketGraphNode, TicketTrace } from '@/lib/types/objects';

const COL_W = 230;
const ROW_H = 96;
const NODE_W = 188;
const NODE_H = 70;
const PAD = 24;

const STATUS_COLOR: Record<string, string> = {
    open: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    in_progress: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    blocked: 'bg-red-500/20 text-red-300 border-red-500/30',
    done: 'bg-green-500/20 text-green-300 border-green-500/30',
    cancelled: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

interface Edge {
    parent_oid: string;
    child_oid: string;
}
interface Consolidated {
    filtered_ticket_oids: string[];
    roots: string[];
    nodes: TicketGraphNode[];
    edges: Edge[];
}

function defaultFrom(tz: string): string {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return `${formatLocalDateTime(d, tz).slice(0, 10)}T00:00:00`;
}
function defaultTo(tz: string): string {
    return `${formatLocalDateTime(new Date(), tz).slice(0, 10)}T23:59:59`;
}

function eventLabel(kind: string): string {
    switch (kind) {
        case 'ticket.created': return 'Created';
        case 'ticket.reassigned': return 'Reassigned';
        case 'ticket.subticket_created': return 'Sub-ticket created';
        case 'ticket.handed_off': return 'Handed off';
        case 'ticket.mention_dispatched': return '@mention dispatched';
        case 'run.started': return 'Run started';
        case 'run.completed': return 'Run completed';
        case 'run.failed': return 'Run failed';
        case 'run.cancelled': return 'Run cancelled';
        case 'human_comment': return 'Comment';
        case 'agent_reply': return 'Agent reply';
        case 'system_note': return 'System';
        default: return kind;
    }
}

function eventAccent(kind: string): string {
    if (kind.startsWith('run.completed') || kind === 'agent_reply') return 'text-purple-400';
    if (kind.startsWith('run.failed')) return 'text-red-400';
    if (kind === 'ticket.reassigned' || kind === 'ticket.mention_dispatched' || kind === 'ticket.handed_off') return 'text-amber-400';
    if (kind === 'human_comment') return 'text-blue-400';
    return 'text-[var(--text-secondary)]';
}

interface Pos { x: number; y: number; }

/** Lay out a forest of trees (multiple roots), stacking trees vertically. */
function computeForestLayout(
    roots: string[],
    nodes: TicketGraphNode[],
    edges: Edge[],
): { pos: Record<string, Pos>; width: number; height: number } {
    const childrenOf: Record<string, string[]> = {};
    for (const e of edges) {
        (childrenOf[e.parent_oid] ??= []).push(e.child_oid);
    }
    const pos: Record<string, Pos> = {};
    const visited = new Set<string>();
    let nextLeafRow = 0;

    const place = (oid: string, depth: number): number => {
        if (visited.has(oid)) return nextLeafRow;
        visited.add(oid);
        const kids = childrenOf[oid] ?? [];
        let row: number;
        if (kids.length === 0) {
            row = nextLeafRow;
            nextLeafRow += 1;
        } else {
            const rows = kids.map((k) => place(k, depth + 1));
            row = (rows[0] + rows[rows.length - 1]) / 2;
        }
        pos[oid] = { x: depth * COL_W + PAD, y: row * ROW_H + PAD };
        return row;
    };

    for (const root of roots) {
        if (!visited.has(root)) {
            place(root, 0);
            nextLeafRow += 1; // blank row between trees
        }
    }
    // Defensive: any node not reached by a root.
    for (const n of nodes) {
        if (!pos[n.oid]) {
            pos[n.oid] = { x: (n.depth ?? 0) * COL_W + PAD, y: nextLeafRow * ROW_H + PAD };
            nextLeafRow += 1;
        }
    }
    const maxDepth = Math.max(0, ...nodes.map((n) => n.depth ?? 0));
    return {
        pos,
        width: (maxDepth + 1) * COL_W + PAD,
        height: Math.max(1, nextLeafRow) * ROW_H + PAD,
    };
}

export function ConsolidatedLineagePage() {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';

    const [dateFrom, setDateFrom] = useState(() => defaultFrom(timezone));
    const [dateTo, setDateTo] = useState(() => defaultTo(timezone));
    const [data, setData] = useState<Consolidated | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedOid, setSelectedOid] = useState<string | null>(null);
    const [trace, setTrace] = useState<TicketTrace | null>(null);
    const [traceLoading, setTraceLoading] = useState(false);

    const load = useCallback(async (from: string, to: string) => {
        setLoading(true);
        const qs = new URLSearchParams();
        if (from) qs.set('created_at_from', localDateTimeToIso(from, timezone));
        if (to) qs.set('created_at_to', localDateTimeToIso(to, timezone));
        try {
            const res = await fetch(`/api/agentops/tickets/lineage/consolidated?${qs.toString()}`, { cache: 'no-store' });
            setData(res.ok ? ((await res.json()) as Consolidated) : null);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [timezone]);

    useEffect(() => {
        void load(dateFrom, dateTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadTrace = useCallback(async (oid: string) => {
        setTraceLoading(true);
        try {
            const res = await fetch(`/api/agentops/tickets/${oid}/trace`);
            if (res.ok) setTrace((await res.json()) as TicketTrace);
        } catch {
            /* ignore */
        } finally {
            setTraceLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedOid) void loadTrace(selectedOid);
    }, [selectedOid, loadTrace]);

    const layout = useMemo(
        () => (data ? computeForestLayout(data.roots, data.nodes, data.edges) : null),
        [data],
    );
    const nodeById = useMemo(
        () => (data ? Object.fromEntries(data.nodes.map((n) => [n.oid, n])) : {}) as Record<string, TicketGraphNode>,
        [data],
    );
    const focusSet = useMemo(() => new Set(data?.filtered_ticket_oids ?? []), [data]);

    const thBtn = 'px-3 py-1.5 rounded-lg text-sm';

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className={`text-2xl font-semibold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        <Network className="w-6 h-6 text-purple-400" /> Ticket Lineage
                    </h1>
                    <span className="text-sm text-[var(--text-secondary)]">
                        {data ? `${data.filtered_ticket_oids.length} ticket(s) · ${data.nodes.length} node(s)` : '—'}
                    </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                    Consolidated parent-child lineage for all tickets created in the selected range.
                </p>

                {/* Date filter — seconds precision, timezone-aware; default past 1 week */}
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className={`block text-[11px] mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>From</label>
                        <input type="datetime-local" step={1} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                            className={`${thBtn} ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`} />
                    </div>
                    <div>
                        <label className={`block text-[11px] mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>To</label>
                        <input type="datetime-local" step={1} value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                            className={`${thBtn} ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`} />
                    </div>
                    <span className={`text-[11px] pb-2 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{formatTzBadge(timezone)}</span>
                    <button onClick={() => void load(dateFrom, dateTo)}
                        className="px-4 py-1.5 rounded-lg text-sm bg-purple-500 hover:bg-purple-600 text-white transition-colors">
                        Apply
                    </button>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-sm text-[var(--text-secondary)]">
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading lineage...</span>
                    </div>
                ) : !data || !layout || data.nodes.length === 0 ? (
                    <div className="py-12 text-center text-sm text-[var(--text-secondary)]">No tickets in this range.</div>
                ) : (
                    <div className="flex flex-col lg:flex-row gap-4">
                        {/* Forest map */}
                        <div className="flex-1 overflow-auto max-h-[calc(100vh-16rem)] rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]" data-testid="consolidated-lineage-map">
                            <div className="relative" style={{ width: layout.width, height: layout.height }}>
                                <svg className="absolute inset-0 pointer-events-none" width={layout.width} height={layout.height}>
                                    {data.edges.map((e, i) => {
                                        const p = layout.pos[e.parent_oid];
                                        const c = layout.pos[e.child_oid];
                                        if (!p || !c) return null;
                                        const x1 = p.x + NODE_W;
                                        const y1 = p.y + NODE_H / 2;
                                        const x2 = c.x;
                                        const y2 = c.y + NODE_H / 2;
                                        const mx = (x1 + x2) / 2;
                                        return (
                                            <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                                                fill="none" strokeWidth={2} strokeOpacity={0.6} style={{ stroke: 'var(--accent-color, #8b5cf6)' }} />
                                        );
                                    })}
                                </svg>
                                {data.nodes.map((n) => {
                                    const p = layout.pos[n.oid];
                                    if (!p) return null;
                                    const isSelected = n.oid === selectedOid;
                                    const isFocus = focusSet.has(n.oid);
                                    return (
                                        <div
                                            key={n.oid}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => setSelectedOid(n.oid)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedOid(n.oid);
                                                }
                                            }}
                                            data-testid={`lineage-node-${n.oid}`}
                                            className={`absolute cursor-pointer text-left rounded-lg border p-2 transition-colors ${
                                                STATUS_COLOR[n.status] ?? STATUS_COLOR.open
                                            } ${isSelected ? 'ring-2 ring-[var(--accent-color)]' : isFocus ? 'ring-1 ring-[var(--accent-color)]/50' : ''} ${
                                                n.has_active_run ? 'animate-pulse' : ''
                                            }`}
                                            style={{ left: p.x, top: p.y, width: NODE_W, minHeight: NODE_H }}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-medium truncate flex-1">{n.title}</span>
                                                <Link href={`/data/agentops/tickets/${n.oid}`} onClick={(e) => e.stopPropagation()} title="Open ticket" className="shrink-0 opacity-60 hover:opacity-100">
                                                    <ExternalLink className="w-3 h-3" />
                                                </Link>
                                            </div>
                                            <div className="text-[10px] mt-1 flex items-center gap-1.5 opacity-90">
                                                <span>{n.assignee ? `${n.assignee.is_agent ? '🤖' : '👤'} ${n.assignee.name ?? '?'}` : 'unassigned'}</span>
                                            </div>
                                            <div className="text-[9px] mt-0.5 flex gap-2 opacity-70">
                                                <span>{n.status.replace('_', ' ')}</span>
                                                <span>· {n.run_count} run{n.run_count === 1 ? '' : 's'}</span>
                                                {n.handoff_count > 0 && <span>· {n.handoff_count} handoff{n.handoff_count === 1 ? '' : 's'}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Trace side panel */}
                        <div className="lg:w-96 shrink-0 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
                            <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                                Trace {selectedOid && nodeById[selectedOid] ? `· ${nodeById[selectedOid].title}` : ''}
                            </h3>
                            {!selectedOid ? (
                                <div className="py-4 text-center text-xs text-[var(--text-secondary)]">Select a ticket node.</div>
                            ) : traceLoading ? (
                                <div className="py-4 text-center text-xs text-[var(--text-secondary)]"><Loader2 className="w-4 h-4 animate-spin inline" /></div>
                            ) : trace && trace.events.length > 0 ? (
                                <ol className="space-y-2 max-h-[460px] overflow-y-auto" data-testid="trace-events">
                                    {trace.events.map((ev, i) => (
                                        <li key={i} className="text-xs border-l-2 border-[var(--card-border)] pl-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`font-medium ${eventAccent(ev.kind)}`}>{eventLabel(ev.kind)}</span>
                                                <span className="text-[10px] text-[var(--text-secondary)]">{formatDateTime(ev.ts, timezone)}</span>
                                            </div>
                                            {ev.body && <div className="text-[var(--text-secondary)] mt-0.5 line-clamp-2">{ev.body}</div>}
                                            {ev.session && (
                                                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 font-mono break-all">session {ev.session}</div>
                                            )}
                                            {ev.failure_reason && <div className="text-[10px] text-red-400 mt-0.5">{ev.failure_reason}</div>}
                                        </li>
                                    ))}
                                </ol>
                            ) : (
                                <div className="py-4 text-center text-xs text-[var(--text-secondary)]">No events.</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
