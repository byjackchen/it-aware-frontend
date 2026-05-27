'use client';

/**
 * Ticket detail page client component (AgentOps v2).
 *
 * The comment box drives the "session" feature: posting a human_comment on an
 * agent-assigned ticket dispatches the assigned agent, and the backend reuses
 * the prior run's conversation_id so the conversation continues in the same
 * Knot session. We surface the agent's reply by polling `has_active_run` and
 * reloading the thread when the run finishes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import {
    ArrowLeft,
    Ticket as TicketIcon,
    Save,
    Trash2,
    Loader2,
    Network,
    Plus,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { AgentStatusIndicator } from '@/components/agentops/AgentStatusIndicator';
import { CommentThread } from '@/components/agentops/CommentThread';
import { CommentInput } from '@/components/agentops/CommentInput';
import { TicketLineageMap } from '@/components/agentops/TicketLineageMap';
import type { Ticket, ThreadMessage, ThreadListResponse, TicketStatus, Agent, RunListResponse } from '@/lib/types/objects';
import type { Account } from '@/lib/types/security';
import { createTicketAction, updateTicketAction, deleteTicketAction } from '@/app/actions/objects';

interface TicketDetailPageProps {
    ticket: Ticket;
    accounts: Account[];
    allTickets: Ticket[];
    agents: Agent[];
}

const STATUS_OPTIONS: TicketStatus[] = ['open', 'in_progress', 'blocked', 'done', 'cancelled'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    open: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
    in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    blocked: { bg: 'bg-red-500/20', text: 'text-red-400' },
    done: { bg: 'bg-green-500/20', text: 'text-green-400' },
    cancelled: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
};

export function TicketDetailPage({ ticket, accounts, allTickets, agents }: TicketDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useTransitionRouter();
    const isLight = theme === 'light';
    const [isPending, setIsPending] = useState(false);

    // Editable fields
    const [title, setTitle] = useState(ticket.title);
    const [body, setBody] = useState(ticket.body || '');
    const [status, setStatus] = useState<TicketStatus>(ticket.status);
    const [assigneeOid, setAssigneeOid] = useState(ticket.assignee_account_oid || '');
    const [parentOid, setParentOid] = useState(ticket.parent_ticket_oid || '');
    const [tags, setTags] = useState(ticket.tags?.join(', ') || '');

    // Create-sub-ticket form
    const [showSubForm, setShowSubForm] = useState(false);
    const [subTitle, setSubTitle] = useState('');
    const [subBody, setSubBody] = useState('');
    const [subAssignee, setSubAssignee] = useState('');
    const [subStatus, setSubStatus] = useState<TicketStatus>('open');
    const [subPending, setSubPending] = useState(false);

    const parentOptions = allTickets.filter((t) => t.oid !== ticket.oid);

    // Thread (conversation)
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [threadLoading, setThreadLoading] = useState(true);
    const [replyToOid, setReplyToOid] = useState<string | null>(null);

    // run_oid → agent name, so agent_reply bubbles can name the responding
    // agent. Resolution: agent_reply.run_oid → run.agent_oid → agent.name.
    const [agentByRun, setAgentByRun] = useState<Record<string, string>>({});

    // Agent running state — derived from the ticket's has_active_run flag.
    const [agentRunning, setAgentRunning] = useState(Boolean(ticket.has_active_run));
    const [showLineage, setShowLineage] = useState(false);
    const prevMessageCountRef = useRef(0);

    const loadThread = useCallback(async () => {
        try {
            const res = await fetch(`/api/agentops/tickets/${ticket.oid}/thread`);
            if (res.ok) {
                const data = (await res.json()) as ThreadListResponse;
                setMessages(data.items);
            }
        } catch {
            // ignore
        } finally {
            setThreadLoading(false);
        }
    }, [ticket.oid]);

    useEffect(() => {
        void loadThread();
    }, [loadThread]);

    // Build run_oid → agent name. Fetch the ticket's runs (run → agent_oid) and
    // combine with the agents list (agent_oid → name) passed from the server.
    useEffect(() => {
        let cancelled = false;
        const buildMap = async () => {
            try {
                const res = await fetch(`/api/agentops/runs?ticket_oid=${ticket.oid}&limit=200`);
                if (!res.ok) return;
                const data = (await res.json()) as RunListResponse;
                const nameByAgent = new Map(agents.map((a) => [a.oid, a.name]));
                const map: Record<string, string> = {};
                for (const run of data.items) {
                    const name = nameByAgent.get(run.agent_oid);
                    if (name) map[run.oid] = name;
                }
                if (!cancelled) setAgentByRun(map);
            } catch {
                // best-effort; bubbles fall back to the generic "Agent" label
            }
        };
        void buildMap();
        return () => { cancelled = true; };
    }, [ticket.oid, agents]);

    // Poll the ticket while a run is active (every 3s). When has_active_run
    // flips false the agent finished (including any drained follow-up turns),
    // so reload the thread to pick up the agent_reply. Works across pods —
    // no WebSocket needed.
    useEffect(() => {
        if (!agentRunning) return;

        prevMessageCountRef.current = messages.length;

        const interval = setInterval(async () => {
            try {
                const ticketRes = await fetch(`/api/agentops/tickets/${ticket.oid}`);
                if (!ticketRes.ok) return;
                const ticketData = (await ticketRes.json()) as Ticket;
                if (!ticketData.has_active_run) {
                    setAgentRunning(false);
                    void loadThread();
                }
            } catch {
                // ignore polling errors
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [agentRunning, ticket.oid, loadThread, messages.length]);

    const handleSave = async () => {
        // Client-side cycle pre-check (mirrors the backend guard) so the user
        // gets a clear message instead of an opaque server-action error.
        if (parentOid.trim()) {
            const byOid = new Map(allTickets.map((t) => [t.oid, t]));
            const seen = new Set<string>();
            let cur: string | null | undefined = parentOid.trim();
            while (cur) {
                if (cur === ticket.oid) {
                    alert('Cannot set parent: that would create a cycle (the selected ticket is a descendant of this one).');
                    return;
                }
                if (seen.has(cur)) break;
                seen.add(cur);
                cur = byOid.get(cur)?.parent_ticket_oid;
            }
        }
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('title', title);
            formData.set('body', body);
            formData.set('status', status);
            if (assigneeOid.trim()) formData.set('assignee_account_oid', assigneeOid.trim());
            if (parentOid.trim()) formData.set('parent_ticket_oid', parentOid.trim());
            const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
            if (tagList.length > 0) formData.set('tags', JSON.stringify(tagList));

            await updateTicketAction(ticket.oid, formData);
            router.refresh();
        } catch (error) {
            console.error('Failed to update ticket:', error);
            alert(error instanceof Error ? error.message : 'Failed to update ticket');
        } finally {
            setIsPending(false);
        }
    };

    const handleCreateSubticket = async () => {
        if (!subTitle.trim()) return;
        setSubPending(true);
        try {
            const formData = new FormData();
            formData.set('title', subTitle.trim());
            if (subBody.trim()) formData.set('body', subBody.trim());
            formData.set('status', subStatus);
            if (subAssignee.trim()) formData.set('assignee_account_oid', subAssignee.trim());
            formData.set('parent_ticket_oid', ticket.oid);
            const res = await createTicketAction(formData);
            // Navigate to the freshly created sub-ticket.
            router.push(`/data/agentops/tickets/${res.ticket.oid}`);
        } catch (error) {
            console.error('Failed to create sub-ticket:', error);
            alert(error instanceof Error ? error.message : 'Failed to create sub-ticket');
        } finally {
            setSubPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this ticket?')) return;
        setIsPending(true);
        try {
            await deleteTicketAction(ticket.oid);
            router.push('/data/agentops/tickets');
        } catch (error) {
            console.error('Failed to delete ticket:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete ticket');
        } finally {
            setIsPending(false);
        }
    };

    const handleSubmitComment = async (content: string, replyToMessageOid?: string) => {
        const res = await fetch(`/api/agentops/thread-messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticket_oid: ticket.oid,
                body: content,
                reply_to_message_oid: replyToMessageOid,
            }),
        });
        if (!res.ok) {
            throw new Error('Failed to post comment');
        }
        const newMessage = (await res.json()) as ThreadMessage;
        setMessages(prev => [...prev, newMessage]);
        setReplyToOid(null);
        // If the assignee is an agent, the backend just dispatched a run.
        // Begin polling so the reply shows up when it completes.
        setAgentRunning(true);
    };

    const replyToMessage = messages.find(m => m.oid === replyToOid);

    const inputClass = `w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`;
    const labelClass = `block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`;
    const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.open;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/agentops/tickets')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                                <TicketIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Ticket Details</h1>
                                <p className={`text-sm flex items-center gap-2 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    <span className="font-mono">{ticket.oid}</span>
                                    <AgentStatusIndicator agentStatus={agentRunning ? 'running' : 'idle'} size="sm" />
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                            {status.replace('_', ' ')}
                        </span>
                        <div className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                            Created {formatDateTime(ticket.created_at, timezone)} &middot; Updated {formatDateTime(ticket.updated_at, timezone)}
                        </div>
                    </div>
                </div>

                {/* Main grid: conversation (left, wide) + editing rail (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Editing rail — fields + create sub-ticket (sticky on lg) */}
                <div className="lg:col-span-1 lg:order-2 space-y-6 lg:sticky lg:top-4 self-start">
                {/* Fields section */}
                <div className={`rounded-xl border p-6 space-y-5 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div>
                        <label className={labelClass}>Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Body</label>
                        <textarea
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            rows={4}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Status</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as TicketStatus)}
                            className={inputClass}
                        >
                            {STATUS_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Assignee</label>
                        <select
                            value={assigneeOid}
                            onChange={(e) => setAssigneeOid(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">Unassigned</option>
                            {accounts.map(account => (
                                <option key={account.oid} value={account.oid}>
                                    {account.username} ({account.account_type})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Parent ticket</label>
                        <select
                            value={parentOid}
                            onChange={(e) => setParentOid(e.target.value)}
                            className={inputClass}
                            data-testid="parent-select"
                        >
                            <option value="">— None —</option>
                            {parentOptions.map((t) => (
                                <option key={t.oid} value={t.oid}>
                                    {t.title} ({t.oid})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className={labelClass}>Tags (comma-separated)</label>
                        <input
                            type="text"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            className={inputClass}
                            placeholder="e.g. bug, urgent, backend"
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            onClick={() => void handleSave()}
                            disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 transition-colors"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Save Changes</span>
                        </button>
                        <button
                            onClick={() => void handleDelete()}
                            disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                        </button>
                    </div>
                </div>

                {/* Create sub-ticket */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <button
                        onClick={() => setShowSubForm((v) => !v)}
                        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                    >
                        <span className={`flex items-center gap-2 text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            <Plus className="w-4 h-4" /> Create sub-ticket
                        </span>
                        <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{showSubForm ? 'Hide' : 'Show'}</span>
                    </button>
                    {showSubForm && (
                        <div className="p-4 border-t border-[var(--card-border)] space-y-4">
                            <div>
                                <label className={labelClass}>Title</label>
                                <input
                                    type="text"
                                    value={subTitle}
                                    onChange={(e) => setSubTitle(e.target.value)}
                                    className={inputClass}
                                    placeholder="Sub-ticket title"
                                    data-testid="sub-title"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Body</label>
                                <textarea
                                    value={subBody}
                                    onChange={(e) => setSubBody(e.target.value)}
                                    rows={2}
                                    className={inputClass}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Status</label>
                                    <select
                                        value={subStatus}
                                        onChange={(e) => setSubStatus(e.target.value as TicketStatus)}
                                        className={inputClass}
                                    >
                                        {STATUS_OPTIONS.map((opt) => (
                                            <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Assignee</label>
                                    <select
                                        value={subAssignee}
                                        onChange={(e) => setSubAssignee(e.target.value)}
                                        className={inputClass}
                                        data-testid="sub-assignee"
                                    >
                                        <option value="">Unassigned</option>
                                        {accounts.map((account) => (
                                            <option key={account.oid} value={account.oid}>
                                                {account.username} ({account.account_type})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <button
                                onClick={() => void handleCreateSubticket()}
                                disabled={subPending || !subTitle.trim()}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 transition-colors"
                                data-testid="sub-create"
                            >
                                {subPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                <span>Create sub-ticket</span>
                            </button>
                            <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                Parent is set to this ticket. Assign to an agent + status in&nbsp;progress to dispatch with parent guidance.
                            </p>
                        </div>
                    )}
                </div>
                </div>{/* /editing rail */}

                {/* Conversation (main column, wide) */}
                <div className="lg:col-span-2 lg:order-1">
                {/* Conversation section */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                        <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Conversation ({messages.length})
                        </h2>
                    </div>

                    {threadLoading ? (
                        <div className={`py-8 text-center text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading conversation...</span>
                        </div>
                    ) : (
                        <CommentThread
                            messages={messages}
                            onReply={(oid) => setReplyToOid(oid)}
                            agentRunning={agentRunning}
                            agentByRun={agentByRun}
                        />
                    )}

                    <CommentInput
                        onSubmit={handleSubmitComment}
                        replyToOid={replyToOid}
                        replyToPreview={replyToMessage?.body}
                        onCancelReply={() => setReplyToOid(null)}
                    />
                </div>
                </div>{/* /conversation main column */}
                </div>{/* /main grid */}

                {/* Lineage / mind-map + trace */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <button
                        onClick={() => setShowLineage((v) => !v)}
                        className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                    >
                        <span className={`flex items-center gap-2 text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            <Network className="w-4 h-4" /> Lineage &amp; Trace
                        </span>
                        <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{showLineage ? 'Hide' : 'Show'}</span>
                    </button>
                    {showLineage && (
                        <div className="p-4 border-t border-[var(--card-border)]">
                            <TicketLineageMap ticketOid={ticket.oid} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
