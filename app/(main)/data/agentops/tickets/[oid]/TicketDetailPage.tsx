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
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { AgentStatusIndicator } from '@/components/agentops/AgentStatusIndicator';
import { CommentThread } from '@/components/agentops/CommentThread';
import { CommentInput } from '@/components/agentops/CommentInput';
import type { Ticket, ThreadMessage, ThreadListResponse, TicketStatus } from '@/lib/types/objects';
import type { Account } from '@/lib/types/security';
import { updateTicketAction, deleteTicketAction } from '@/app/actions/objects';

interface TicketDetailPageProps {
    ticket: Ticket;
    accounts: Account[];
}

const STATUS_OPTIONS: TicketStatus[] = ['open', 'in_progress', 'blocked', 'done', 'cancelled'];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    open: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
    in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    blocked: { bg: 'bg-red-500/20', text: 'text-red-400' },
    done: { bg: 'bg-green-500/20', text: 'text-green-400' },
    cancelled: { bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
};

export function TicketDetailPage({ ticket, accounts }: TicketDetailPageProps) {
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
    const [tags, setTags] = useState(ticket.tags?.join(', ') || '');

    // Thread (conversation)
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [threadLoading, setThreadLoading] = useState(true);
    const [replyToOid, setReplyToOid] = useState<string | null>(null);

    // Agent running state — derived from the ticket's has_active_run flag.
    const [agentRunning, setAgentRunning] = useState(Boolean(ticket.has_active_run));
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
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('title', title);
            formData.set('body', body);
            formData.set('status', status);
            if (assigneeOid.trim()) formData.set('assignee_account_oid', assigneeOid.trim());
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
            <div className="max-w-5xl mx-auto space-y-6">
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
                                    <span>{ticket.oid.slice(0, 12)}...</span>
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
                        />
                    )}

                    <CommentInput
                        onSubmit={handleSubmitComment}
                        replyToOid={replyToOid}
                        replyToPreview={replyToMessage?.body}
                        onCancelReply={() => setReplyToOid(null)}
                    />
                </div>
            </div>
        </div>
    );
}
