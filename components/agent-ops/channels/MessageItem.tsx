'use client';

import { useState } from 'react';
import {
    deleteMessage,
    editMessage,
    pinMessage,
    toggleReaction,
} from '@/lib/api/channels';
import type { ChannelMessage } from '@/lib/api/channels';
import {
    claimTicket,
    createTicketFromMessage,
    markTicketDone,
} from '@/lib/api/tickets-channel';
import type { Ticket, TicketStatus } from '@/lib/api/tickets-channel';
import { renderMarkdown } from '@/lib/markdown';
import { formatRelative } from '@/lib/relative-time';

// Opaque palette. The earlier translucent fills (`/30`, `/40`, …) overlapped
// awkwardly when bubbles sat near each other or on top of the panel chrome.
const KIND_STYLES: Record<string, string> = {
    human_post:
        'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-slate-900 dark:text-slate-100',
    agent_reply:
        'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-slate-900 dark:text-slate-100',
    system_note:
        'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-slate-700 dark:text-amber-100 text-sm italic',
};

const KIND_LABEL: Record<string, string> = {
    human_post: '👤 human',
    agent_reply: '🤖 agent',
    system_note: 'ℹ️ system',
};

const QUICK_EMOJIS = ['👍', '❤️', '😄', '🎉', '🤔', '🚀'];

interface Props {
    message: ChannelMessage;
    /** Parent message if this is a reply — drives the quote-tag header. */
    repliedTo?: ChannelMessage;
    currentAccountOid?: string;
    /** Set the composer's reply target. Replaces the old "open thread modal" verb. */
    onSetReplyTarget?: (m: ChannelMessage | null) => void;
    ticket?: Ticket;
}

const TICKET_BADGE_STYLE: Record<TicketStatus, string> = {
    open: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    in_progress: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 border-amber-300 dark:border-amber-700',
    blocked: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 border-red-300 dark:border-red-700',
    done: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 border-green-300 dark:border-green-700',
    cancelled: 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700',
};

export function MessageItem({
    message: m,
    repliedTo,
    currentAccountOid,
    onSetReplyTarget,
    ticket,
}: Props) {
    const cls = KIND_STYLES[m.kind] ?? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100';
    const isMine = !!currentAccountOid && m.author_account_oid === currentAccountOid;
    const isDeleted = !!m.deleted_at;
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(m.body);
    const [showEmoji, setShowEmoji] = useState(false);
    const [busy, setBusy] = useState(false);

    async function onReact(emoji: string) {
        setBusy(true);
        try {
            await toggleReaction(m.channel_oid, m.oid, emoji);
        } finally {
            setBusy(false);
            setShowEmoji(false);
        }
    }
    async function onTogglePin() {
        setBusy(true);
        try {
            await pinMessage(m.channel_oid, m.oid, !m.pinned_at);
        } finally {
            setBusy(false);
        }
    }
    async function onDelete() {
        if (!confirm('Delete this message?')) return;
        setBusy(true);
        try {
            await deleteMessage(m.channel_oid, m.oid);
        } finally {
            setBusy(false);
        }
    }
    async function onSaveEdit() {
        if (!draft.trim() || draft === m.body) {
            setEditing(false);
            return;
        }
        setBusy(true);
        try {
            await editMessage(m.channel_oid, m.oid, draft);
            setEditing(false);
        } finally {
            setBusy(false);
        }
    }
    async function onCreateTicket() {
        const titleDefault = m.body.split('\n')[0].slice(0, 200);
        const title = prompt('Open task with title:', titleDefault);
        if (!title || !title.trim()) return;
        setBusy(true);
        try {
            await createTicketFromMessage({
                channel_message_oid: m.oid,
                title: title.trim(),
                body: m.body,
            });
        } catch (e: unknown) {
            alert(`Failed: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    }
    async function onClaimTicket() {
        if (!ticket) return;
        setBusy(true);
        try {
            await claimTicket(ticket.oid);
        } catch (e: unknown) {
            alert(`Failed: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    }
    async function onMarkDone() {
        if (!ticket) return;
        setBusy(true);
        try {
            await markTicketDone(ticket.oid);
        } catch (e: unknown) {
            alert(`Failed: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    }

    const hoverBtn =
        'px-1.5 py-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700';

    return (
        <div className={`group relative border rounded p-3 mb-2 ${cls}`}>
            {m.pinned_at && (
                <div className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-1">
                    📌 pinned
                </div>
            )}
            {repliedTo && (
                <div className="mb-2 pl-3 border-l-2 border-slate-400 dark:border-slate-500 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 italic">
                    Replying to: {repliedTo.body.slice(0, 150)}
                </div>
            )}
            <div className="flex items-center justify-between gap-2 mb-1">
                <div className="text-xs text-slate-600 dark:text-slate-400">
                    {KIND_LABEL[m.kind] ?? m.kind} ·{' '}
                    <span
                        title={new Date(m.created_at).toLocaleString()}
                        className="cursor-help"
                    >
                        {formatRelative(m.created_at)}
                    </span>
                    {m.edited_at && <span className="ml-1 italic">(edited)</span>}
                </div>
                {!isDeleted && (
                    <div className="opacity-0 group-hover:opacity-100 transition flex gap-1 text-xs">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setShowEmoji((s) => !s)}
                            className={hoverBtn}
                            title="Add reaction"
                        >
                            😀
                        </button>
                        {onSetReplyTarget && (
                            <button
                                type="button"
                                onClick={() => onSetReplyTarget(m)}
                                className={hoverBtn}
                                title="Reply"
                            >
                                ↩️
                            </button>
                        )}
                        {!ticket && m.kind === 'human_post' && (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={onCreateTicket}
                                className={hoverBtn}
                                title="Open as task"
                            >
                                🎫
                            </button>
                        )}
                        <button
                            type="button"
                            disabled={busy}
                            onClick={onTogglePin}
                            className={hoverBtn}
                            title={m.pinned_at ? 'Unpin' : 'Pin'}
                        >
                            📌
                        </button>
                        {isMine && m.kind === 'human_post' && (
                            <>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => {
                                        setDraft(m.body);
                                        setEditing(true);
                                    }}
                                    className={hoverBtn}
                                    title="Edit"
                                >
                                    ✏️
                                </button>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={onDelete}
                                    className={hoverBtn}
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
            {showEmoji && (
                <div className="flex gap-1 mb-2 p-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                    {QUICK_EMOJIS.map((e) => (
                        <button
                            key={e}
                            type="button"
                            onClick={() => onReact(e)}
                            className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded px-1"
                        >
                            {e}
                        </button>
                    ))}
                </div>
            )}
            {editing ? (
                <div className="space-y-1">
                    <textarea
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        className="w-full border border-slate-300 dark:border-slate-700 rounded p-2 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-[3rem]"
                    />
                    <div className="flex gap-2 text-xs">
                        <button
                            type="button"
                            onClick={onSaveEdit}
                            disabled={busy}
                            className="px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                        >
                            Save
                        </button>
                        <button
                            type="button"
                            onClick={() => setEditing(false)}
                            className="px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className="whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{
                        __html: renderBodyWithMentions(m.body),
                    }}
                />
            )}
            {m.reactions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {m.reactions.map((r) => (
                        <button
                            key={r.emoji}
                            type="button"
                            disabled={busy}
                            onClick={() => onReact(r.emoji)}
                            className={`text-xs rounded-full border px-2 py-0.5 ${
                                r.mine
                                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200'
                                    : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            {r.emoji} {r.count}
                        </button>
                    ))}
                </div>
            )}
            {ticket && (
                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                    <span
                        className={`rounded-full border px-2 py-0.5 ${TICKET_BADGE_STYLE[ticket.status]}`}
                    >
                        🎫 #{ticket.oid.slice(0, 8)} — {ticket.status}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300 truncate max-w-xs">
                        {ticket.title}
                    </span>
                    {ticket.status === 'open' || ticket.status === 'blocked' ? (
                        <button
                            type="button"
                            onClick={onClaimTicket}
                            disabled={busy}
                            className="text-blue-600 dark:text-blue-300 hover:underline disabled:opacity-50"
                        >
                            Claim
                        </button>
                    ) : null}
                    {ticket.status === 'in_progress' && (
                        <button
                            type="button"
                            onClick={onMarkDone}
                            disabled={busy}
                            className="text-green-700 dark:text-green-300 hover:underline disabled:opacity-50"
                        >
                            Mark done
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function renderBodyWithMentions(body: string): string {
    const md = renderMarkdown(body);
    return md.replace(
        /@([a-zA-Z][a-zA-Z0-9_-]*)/g,
        (_m, name) =>
            `<span class="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 px-1 rounded font-mono text-sm">@${name}</span>`,
    );
}
