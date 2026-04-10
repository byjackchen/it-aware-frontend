'use client';

/**
 * Ticket detail page client component.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Ticket as TicketIcon,
    Save,
    Trash2,
    Loader2,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { AgentStatusIndicator } from '@/components/agentops/AgentStatusIndicator';
import { CommentThread } from '@/components/agentops/CommentThread';
import { CommentInput } from '@/components/agentops/CommentInput';
import { useTicketWebSocket } from '@/lib/hooks/useTicketWebSocket';
import type { Ticket, TicketComment, TicketCommentListResponse } from '@/lib/types/objects';
import type { Account } from '@/lib/types/security';
import { updateTicketAction, deleteTicketAction } from '@/app/actions/objects';

interface TicketDetailPageProps {
    ticket: Ticket;
    accounts: Account[];
}

const STATUS_OPTIONS = ['backlog', 'in_progress', 'blocked', 'done'] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    backlog: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
    in_progress: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    blocked: { bg: 'bg-red-500/20', text: 'text-red-400' },
    done: { bg: 'bg-green-500/20', text: 'text-green-400' },
};

export function TicketDetailPage({ ticket, accounts }: TicketDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isPending, setIsPending] = useState(false);

    // Editable fields
    const [title, setTitle] = useState(ticket.title);
    const [description, setDescription] = useState(ticket.description || '');
    const [status, setStatus] = useState(ticket.status);
    const [flagged, setFlagged] = useState(ticket.flagged);
    const [assigneeOid, setAssigneeOid] = useState(ticket.assignee_account_oid || '');
    const [tags, setTags] = useState(ticket.tags?.join(', ') || '');

    // Comments
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(true);
    const [replyToOid, setReplyToOid] = useState<string | null>(null);

    // WebSocket
    const { subscribe, isConnected } = useTicketWebSocket(ticket.oid);

    // Streaming state for agent output
    const [agentRunning, setAgentRunning] = useState(ticket.agent_status === 'running');
    const [streamingContent, setStreamingContent] = useState('');

    const loadComments = useCallback(async () => {
        try {
            const res = await fetch(`/api/agentops/tickets/${ticket.oid}/comments?limit=200`);
            if (res.ok) {
                const data = (await res.json()) as TicketCommentListResponse;
                setComments(data.items);
            }
        } catch {
            // ignore
        } finally {
            setCommentsLoading(false);
        }
    }, [ticket.oid]);

    useEffect(() => {
        void loadComments();
    }, [loadComments]);

    // Subscribe to WebSocket events
    useEffect(() => {
        const unsubscribe = subscribe((event) => {
            if (event.type === 'comment_added') {
                void loadComments();
            } else if (event.type === 'agent_started') {
                setAgentRunning(true);
                setStreamingContent('');
            } else if (event.type === 'agent_content') {
                setStreamingContent(prev => prev + ((event.content as string) || ''));
            } else if (event.type === 'agent_completed' || event.type === 'agent_error') {
                setAgentRunning(false);
                setStreamingContent('');
                void loadComments();
            }
        });
        return unsubscribe;
    }, [subscribe, loadComments]);

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('title', title);
            formData.set('description', description);
            formData.set('status', status);
            formData.set('flagged', String(flagged));
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

    const handleSubmitComment = async (content: string, repliedToOid?: string) => {
        const res = await fetch(`/api/agentops/tickets/${ticket.oid}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, replied_to_comment_oid: repliedToOid }),
        });
        if (!res.ok) {
            throw new Error('Failed to post comment');
        }
        const newComment = (await res.json()) as TicketComment;
        setComments(prev => [...prev, newComment]);
        setReplyToOid(null);
    };

    const handleDeleteComment = async (commentOid: string) => {
        if (!confirm('Delete this comment?')) return;
        const res = await fetch(`/api/agentops/tickets/${ticket.oid}/comments/${commentOid}`, {
            method: 'DELETE',
        });
        if (res.ok) {
            setComments(prev => prev.filter(c => c.oid !== commentOid));
        }
    };

    const replyToComment = comments.find(c => c.oid === replyToOid);

    const inputClass = `w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`;
    const labelClass = `block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`;
    const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.backlog;

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
                                    <AgentStatusIndicator agentStatus={agentRunning ? 'running' : ticket.agent_status} size="sm" />
                                    {isConnected && (
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" title="Live updates connected" />
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                            {status.replace('_', ' ')}
                        </span>
                        <div className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                            Created {new Date(ticket.created_at).toLocaleDateString()} &middot; Updated {new Date(ticket.updated_at).toLocaleDateString()}
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
                        <label className={labelClass}>Description</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className={inputClass}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Status</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value as typeof status)}
                                className={inputClass}
                            >
                                {STATUS_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-3 pt-5">
                            <input
                                type="checkbox"
                                id="flagged"
                                checked={flagged}
                                onChange={(e) => setFlagged(e.target.checked)}
                                className="w-4 h-4"
                            />
                            <label htmlFor="flagged" className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>Flagged</label>
                        </div>
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

                {/* Comments section */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                        <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Comments ({comments.length})
                        </h2>
                    </div>

                    {commentsLoading ? (
                        <div className={`py-8 text-center text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading comments...</span>
                        </div>
                    ) : (
                        <CommentThread
                            comments={comments}
                            onReply={(oid) => setReplyToOid(oid)}
                            onDelete={handleDeleteComment}
                            streamingContent={streamingContent}
                            agentRunning={agentRunning}
                        />
                    )}

                    <CommentInput
                        onSubmit={handleSubmitComment}
                        replyToOid={replyToOid}
                        replyToPreview={replyToComment?.content}
                        onCancelReply={() => setReplyToOid(null)}
                    />
                </div>
            </div>
        </div>
    );
}
