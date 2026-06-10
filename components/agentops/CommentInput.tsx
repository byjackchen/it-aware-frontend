'use client';

import { useState } from 'react';
import { Send, X } from 'lucide-react';

interface CommentInputProps {
    onSubmit: (content: string, repliedToOid?: string) => Promise<void>;
    replyToOid?: string | null;
    replyToPreview?: string;
    onCancelReply?: () => void;
    disabled?: boolean;
}

export function CommentInput({ onSubmit, replyToOid, replyToPreview, onCancelReply, disabled }: CommentInputProps) {
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!content.trim() || submitting) return;
        setSubmitting(true);
        try {
            await onSubmit(content.trim(), replyToOid || undefined);
            setContent('');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="border-t border-slate-300 dark:border-slate-700 p-4 bg-white dark:bg-slate-900">
            {replyToOid && replyToPreview && (
                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                        Replying to:
                    </span>
                    <span className="truncate flex-1 text-slate-700 dark:text-slate-200">
                        {replyToPreview.slice(0, 100)}
                    </span>
                    <button
                        onClick={onCancelReply}
                        className="shrink-0 rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
                        aria-label="Cancel reply"
                    >
                        <X className="w-3 h-3" />
                    </button>
                </div>
            )}
            <div className="flex gap-2">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 resize-none rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-2 text-sm min-h-[60px]"
                    disabled={disabled}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            void handleSubmit();
                        }
                    }}
                />
                <button
                    onClick={() => void handleSubmit()}
                    disabled={!content.trim() || submitting || disabled}
                    className="self-end px-3 py-2 rounded-lg bg-[var(--accent-color)] text-white disabled:opacity-50"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
