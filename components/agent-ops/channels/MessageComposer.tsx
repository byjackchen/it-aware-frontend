'use client';

import { useEffect, useRef, useState } from 'react';
import { MentionAutocomplete } from './MentionAutocomplete';
import type { ChannelMember } from '@/lib/api/channels';

interface Props {
    members: ChannelMember[];
    onSend: (body: string) => Promise<void>;
}

export function MessageComposer({ members, onSend }: Props) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const ref = useRef<HTMLTextAreaElement>(null);

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
        // Re-focus
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
            await onSend(text);
            setText('');
            setMentionQuery(null);
        } finally {
            setSending(false);
        }
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            send();
        } else if (e.key === 'Escape' && mentionQuery !== null) {
            e.preventDefault();
            setMentionQuery(null);
        }
    }

    return (
        <div className="border-t p-3 relative bg-card">
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
                    className="flex-1 border rounded p-2 min-h-[3rem] resize-y bg-background"
                    value={text}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    placeholder="Type a message — @agent to mention. Cmd/Ctrl-Enter sends."
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
