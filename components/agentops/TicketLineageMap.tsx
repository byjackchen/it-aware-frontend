'use client';

/**
 * Ticket lineage mind-map (dependency-free).
 *
 * Renders the parent-child tree from GET /tickets/{oid}/graph as a left-to-right
 * tidy tree (SVG edges + positioned node cards), and a side panel showing the
 * selected node's merged trace timeline from GET /tickets/{oid}/trace. Built
 * without a graph library to avoid adding a dependency; the layout is a simple
 * leaf-counting tree placement.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { TicketGraph, TicketGraphNode, TicketTrace } from '@/lib/types/objects';

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

interface Pos {
    x: number;
    y: number;
}

function computeLayout(graph: TicketGraph): {
    pos: Record<string, Pos>;
    width: number;
    height: number;
} {
    const childrenOf: Record<string, string[]> = {};
    for (const e of graph.edges) {
        (childrenOf[e.parent_oid] ??= []).push(e.child_oid);
    }
    const pos: Record<string, Pos> = {};
    const visited = new Set<string>();
    let nextLeafRow = 0;

    const place = (oid: string, depth: number): number => {
        if (visited.has(oid)) return nextLeafRow; // cycle guard (shouldn't happen)
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

    if (graph.nodes.some((n) => n.oid === graph.root_oid)) {
        place(graph.root_oid, 0);
    }
    // Any node not reached (defensive) gets stacked at the bottom.
    for (const n of graph.nodes) {
        if (!pos[n.oid]) {
            pos[n.oid] = { x: n.depth * COL_W + PAD, y: nextLeafRow * ROW_H + PAD };
            nextLeafRow += 1;
        }
    }
    const maxDepth = Math.max(0, ...graph.nodes.map((n) => n.depth));
    return {
        pos,
        width: (maxDepth + 1) * COL_W + PAD,
        height: Math.max(1, nextLeafRow) * ROW_H + PAD,
    };
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

export function TicketLineageMap({ ticketOid }: { ticketOid: string }) {
    const { timezone } = useTimezone();
    const [graph, setGraph] = useState<TicketGraph | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedOid, setSelectedOid] = useState<string | null>(null);
    const [trace, setTrace] = useState<TicketTrace | null>(null);
    const [traceLoading, setTraceLoading] = useState(false);

    useEffect(() => {
        let active = true;
        setLoading(true);
        fetch(`/api/agentops/tickets/${ticketOid}/graph`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((g: TicketGraph) => {
                if (!active) return;
                setGraph(g);
                setSelectedOid(g.focus_oid);
            })
            .catch(() => active && setGraph(null))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [ticketOid]);

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

    const layout = useMemo(() => (graph ? computeLayout(graph) : null), [graph]);

    if (loading) {
        return (
            <div className="py-8 text-center text-sm text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading lineage...
                </span>
            </div>
        );
    }
    if (!graph || !layout) {
        return <div className="py-8 text-center text-sm text-[var(--text-secondary)]">No lineage available.</div>;
    }

    const nodeById: Record<string, TicketGraphNode> = Object.fromEntries(graph.nodes.map((n) => [n.oid, n]));

    return (
        <div className="flex flex-col lg:flex-row gap-4">
            {/* Map */}
            <div className="flex-1 overflow-auto max-h-[70vh] rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]" data-testid="lineage-map">
                <div className="relative" style={{ width: layout.width, height: layout.height }}>
                    <svg className="absolute inset-0 pointer-events-none" width={layout.width} height={layout.height}>
                        {graph.edges.map((e, i) => {
                            const p = layout.pos[e.parent_oid];
                            const c = layout.pos[e.child_oid];
                            if (!p || !c) return null;
                            const x1 = p.x + NODE_W;
                            const y1 = p.y + NODE_H / 2;
                            const x2 = c.x;
                            const y2 = c.y + NODE_H / 2;
                            const mx = (x1 + x2) / 2;
                            return (
                                <path
                                    key={i}
                                    d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                                    fill="none"
                                    strokeWidth={2}
                                    strokeOpacity={0.6}
                                    style={{ stroke: 'var(--accent-color, #8b5cf6)' }}
                                />
                            );
                        })}
                    </svg>
                    {graph.nodes.map((n) => {
                        const p = layout.pos[n.oid];
                        if (!p) return null;
                        const isSelected = n.oid === selectedOid;
                        const isFocus = n.oid === graph.focus_oid;
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
                                } ${isSelected ? 'ring-2 ring-[var(--accent-color)]' : ''} ${
                                    n.has_active_run ? 'animate-pulse' : ''
                                }`}
                                style={{ left: p.x, top: p.y, width: NODE_W, minHeight: NODE_H }}
                            >
                                <div className="flex items-center gap-1">
                                    <span className="text-xs font-medium truncate flex-1">{n.title}</span>
                                    {isFocus && <span className="text-[9px] px-1 rounded bg-[var(--accent-color)] text-white">focus</span>}
                                    <Link
                                        href={`/data/agentops/tickets/${n.oid}`}
                                        onClick={(e) => e.stopPropagation()}
                                        title="Open ticket"
                                        className="shrink-0 opacity-60 hover:opacity-100"
                                    >
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
                {traceLoading ? (
                    <div className="py-4 text-center text-xs text-[var(--text-secondary)]">
                        <Loader2 className="w-4 h-4 animate-spin inline" />
                    </div>
                ) : trace && trace.events.length > 0 ? (
                    <ol className="space-y-2 max-h-[420px] overflow-y-auto" data-testid="trace-events">
                        {trace.events.map((ev, i) => (
                            <li key={i} className="text-xs border-l-2 border-[var(--card-border)] pl-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className={`font-medium ${eventAccent(ev.kind)}`}>{eventLabel(ev.kind)}</span>
                                    <span className="text-[10px] text-[var(--text-secondary)]">{formatDateTime(ev.ts, timezone)}</span>
                                </div>
                                {ev.body && <div className="text-[var(--text-secondary)] mt-0.5 line-clamp-2">{ev.body}</div>}
                                {ev.session && (
                                    <div className="text-[10px] text-[var(--text-secondary)] mt-0.5 font-mono break-all">
                                        session {ev.session}
                                    </div>
                                )}
                                {ev.failure_reason && (
                                    <div className="text-[10px] text-red-400 mt-0.5">{ev.failure_reason}</div>
                                )}
                            </li>
                        ))}
                    </ol>
                ) : (
                    <div className="py-4 text-center text-xs text-[var(--text-secondary)]">No events.</div>
                )}
            </div>
        </div>
    );
}
