'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { MentionAutocomplete } from './MentionAutocomplete';
import type { ChannelMember, ChannelMessage } from '@/lib/api/channels';

interface Props {
    members: ChannelMember[];
    onSend: (body: string, replyToMessageOid?: string) => Promise<void>;
    replyTo?: ChannelMessage | null;
    onCancelReply?: () => void;
}

export function MessageComposer({ members, onSend, replyTo, onCancelReply }: Props) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const ref = useRef<HTMLTextAreaElement>(null);

    // Focus the composer whenever the user picks a new reply target.
    useEffect(() => {
        if (replyTo) ref.current?.focus();
    }, [replyTo]);

    function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        const v = e.target.value;
        setText(v);
        const caret = e.target.selectionStart ?? v.length;
        const slice = v.substring(0, caret);
        const match = slice.match(/@([a-z0-9_-]*)$/i);
        setMentionQuery(match ? match[1] : null);
    }

    function pickMention(username: string) {
        const el = ref.current;
        if (!el) return;
        const caret = el.selectionStart ?? text.length;
        const before = text.substring(0, caret).replace(/@([a-z0-9_-]*)$/i, `@${username} `);
        const after = text.substring(caret);
        const next = before + after;
        setText(next);
        setMentionQuery(null);
        requestAnimationFrame(() => {
            el.focus();
            const pos = before.length;
            el.setSelectionRange(pos, pos);
        });
    }

    async function send() {
        if (!text.trim() || sending) return;
        setSending(true);
        try {
            await onSend(text, replyTo?.oid);
            setText('');
            setMentionQuery(null);
            onCancelReply?.();
        } finally {
            setSending(false);
        }
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
        } else if (e.key === 'Escape') {
            if (mentionQuery !== null) {
                e.preventDefault();
                setMentionQuery(null);
            } else if (replyTo && onCancelReply) {
                e.preventDefault();
                onCancelReply();
            }
        }
    }

    return (
        <div className="border-t border-slate-300 dark:border-slate-700 p-3 relative bg-white dark:bg-slate-900">
            {replyTo && (
                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                        Replying to:
                    </span>
                    <span className="truncate flex-1 text-slate-700 dark:text-slate-200">
                        {replyTo.body.slice(0, 120)}
                    </span>
                    {onCancelReply && (
                        <button
                            type="button"
                            onClick={onCancelReply}
                            className="shrink-0 rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
                            aria-label="Cancel reply"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
            )}
            {mentionQuery !== null && (
                <div className="absolute bottom-full left-3 right-3 z-10">
                    <MentionAutocomplete
                        query={mentionQuery}
                        members={members}
                        onPick={pickMention}
                    />
                </div>
            )}
            <div className="flex gap-2">
                <textarea
                    ref={ref}
                    className="flex-1 border border-slate-300 dark:border-slate-700 rounded p-2 min-h-[3rem] resize-y bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                    value={text}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    placeholder={
                        replyTo
                            ? 'Reply inline. Cmd/Ctrl-Enter sends. Esc cancels reply.'
                            : 'Type a message — @agent to mention. Cmd/Ctrl-Enter sends.'
                    }
                    disabled={sending}
                />
                <button
                    onClick={send}
                    disabled={sending || !text.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 self-start"
                >
                    {sending ? '…' : 'Send'}
                </button>
            </div>
        </div>
    );
}
