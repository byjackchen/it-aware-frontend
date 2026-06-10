'use client';

import { useRef, useEffect } from 'react';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { ThreadMessage, ThreadMessageKind } from '@/lib/types/objects';
import { MarkdownBody } from './MarkdownBody';

interface CommentThreadProps {
    messages: ThreadMessage[];
    onReply: (messageOid: string) => void;
    agentRunning?: boolean;
    /** run_oid → agent name, so agent_reply bubbles can name the responding agent. */
    agentByRun?: Record<string, string>;
}

const KIND_LABEL: Record<ThreadMessageKind, string> = {
    human_comment: 'Comment',
    agent_reply: 'Agent',
    system_note: 'System',
};

// Opaque palette — translucent bubbles (the previous `*/5`, `*/10` values)
// overlapped awkwardly with the panel chrome behind them.
const KIND_ACCENT: Record<ThreadMessageKind, string> = {
    human_comment:
        'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100',
    agent_reply:
        'border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950 text-slate-900 dark:text-purple-50',
    system_note:
        'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 text-slate-800 dark:text-amber-100',
};

export function CommentThread({ messages, onReply, agentRunning, agentByRun }: CommentThreadProps) {
    const { timezone } = useTimezone();
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages.length]);

    const findRepliedMessage = (oid: string | null) => {
        if (!oid) return null;
        return messages.find(m => m.oid === oid);
    };

    const authorLabel = (m: ThreadMessage) => {
        if (m.kind === 'human_comment' && m.author_account_oid) {
            return `${m.author_account_oid.slice(0, 8)}...`;
        }
        if (m.kind === 'agent_reply' && m.run_oid) {
            const agentName = agentByRun?.[m.run_oid];
            if (agentName) return `🤖 ${agentName}`;
        }
        return KIND_LABEL[m.kind];
    };

    return (
        <div className="space-y-3 max-h-[500px] overflow-y-auto p-4 bg-white dark:bg-slate-900">
            {messages.map(message => {
                const repliedTo = findRepliedMessage(message.reply_to_message_oid);
                return (
                    <div key={message.oid} className={`p-3 rounded-lg border ${KIND_ACCENT[message.kind]}`}>
                        {repliedTo && (
                            <div className="mb-2 pl-3 border-l-2 border-slate-400 dark:border-slate-500 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 italic">
                                Replying to: {repliedTo.body.slice(0, 150)}
                            </div>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-[var(--text-secondary)]">
                                {authorLabel(message)}
                            </span>
                            <span className="text-xs text-[var(--text-secondary)] ml-auto">
                                {formatDateTime(message.created_at, timezone)}
                            </span>
                            {message.kind === 'agent_reply' && message.run_oid && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 border border-purple-300 dark:border-purple-700">
                                    run: {message.run_oid.slice(0, 8)}...
                                </span>
                            )}
                        </div>
                        <MarkdownBody>{message.body}</MarkdownBody>
                        {message.kind !== 'system_note' && (
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => onReply(message.oid)} className="text-xs text-[var(--accent-color)] hover:underline">Reply</button>
                            </div>
                        )}
                    </div>
                );
            })}

            {agentRunning && (
                <div className="p-3 rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 animate-pulse">
                    <div className="text-xs text-blue-700 dark:text-blue-300">Agent is working...</div>
                </div>
            )}
            <div ref={bottomRef} />
        </div>
    );
}
