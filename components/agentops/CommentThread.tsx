'use client';

import { useRef, useEffect } from 'react';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { TicketComment } from '@/lib/types/objects';

interface CommentThreadProps {
    comments: TicketComment[];
    onReply: (commentOid: string) => void;
    onDelete?: (commentOid: string) => void;
    streamingContent?: string;
    agentRunning?: boolean;
}

export function CommentThread({ comments, onReply, onDelete, streamingContent, agentRunning }: CommentThreadProps) {
    const { timezone } = useTimezone();
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments.length, streamingContent]);

    const findRepliedComment = (oid: string | null) => {
        if (!oid) return null;
        return comments.find(c => c.oid === oid);
    };

    return (
        <div className="space-y-3 max-h-[500px] overflow-y-auto p-4">
            {comments.map(comment => {
                const repliedTo = findRepliedComment(comment.replied_to_comment_oid);
                return (
                    <div key={comment.oid} className="p-3 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]">
                        {repliedTo && (
                            <div className="mb-2 pl-3 border-l-2 border-[var(--text-secondary)] text-xs text-[var(--text-secondary)] line-clamp-2">
                                {repliedTo.content.slice(0, 150)}
                            </div>
                        )}
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-[var(--text-secondary)]">
                                {comment.author_account_oid.slice(0, 8)}...
                            </span>
                            <span className="text-xs text-[var(--text-secondary)]">
                                {formatDateTime(comment.created_at, timezone)}
                            </span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap">{comment.content}</div>
                        <div className="flex gap-2 mt-2">
                            <button onClick={() => onReply(comment.oid)} className="text-xs text-[var(--accent-color)] hover:underline">Reply</button>
                            {onDelete && (
                                <button onClick={() => onDelete(comment.oid)} className="text-xs text-red-500 hover:underline">Delete</button>
                            )}
                        </div>
                    </div>
                );
            })}

            {agentRunning && (
                <div className="p-3 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 animate-pulse">
                    <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Agent is working...</div>
                    <div className="text-sm whitespace-pre-wrap">{streamingContent || '...'}</div>
                </div>
            )}
            <div ref={bottomRef} />
        </div>
    );
}
