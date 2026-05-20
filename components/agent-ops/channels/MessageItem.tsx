'use client';

import type { ChannelMessage } from '@/lib/api/channels';

const KIND_STYLES: Record<string, string> = {
    human_post:
        'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/60',
    agent_reply:
        'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900/60',
    system_note:
        'bg-muted border-muted-foreground/20 text-muted-foreground text-sm italic',
};

const KIND_LABEL: Record<string, string> = {
    human_post: '👤 human',
    agent_reply: '🤖 agent',
    system_note: 'ℹ️ system',
};

export function MessageItem({ message }: { message: ChannelMessage }) {
    const cls = KIND_STYLES[message.kind] ?? 'bg-card border';
    return (
        <div className={`border rounded p-3 mb-2 ${cls}`}>
            <div className="text-xs text-muted-foreground mb-1">
                {KIND_LABEL[message.kind] ?? message.kind} ·{' '}
                {new Date(message.created_at).toLocaleString()}
            </div>
            <div className="whitespace-pre-wrap break-words">
                {renderBodyWithMentions(message.body)}
            </div>
        </div>
    );
}

function renderBodyWithMentions(body: string) {
    const parts = body.split(/(@[a-z][a-z0-9_-]*)/gi);
    return parts.map((p, i) =>
        p.startsWith('@') ? (
            <span
                key={i}
                className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200 px-1 rounded font-mono text-sm"
            >
                {p}
            </span>
        ) : (
            <span key={i}>{p}</span>
        ),
    );
}
