'use client';

import { useEffect, useState } from 'react';
import { listThreadReplies, postMessage } from '@/lib/api/channels';
import type { ChannelMessage } from '@/lib/api/channels';
import { MessageItem } from './MessageItem';

interface Props {
    channelOid: string;
    parent: ChannelMessage;
    currentAccountOid?: string;
    onClose: () => void;
}

export function ThreadDialog({
    channelOid,
    parent,
    currentAccountOid,
    onClose,
}: Props) {
    const [replies, setReplies] = useState<ChannelMessage[]>([]);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            const r = await listThreadReplies(channelOid, parent.oid);
            if (!cancelled) setReplies(r.items);
        }
        load();
        const id = setInterval(load, 3000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [channelOid, parent.oid]);

    async function onSend() {
        if (!draft.trim() || busy) return;
        setBusy(true);
        try {
            await postMessage(channelOid, {
                body: draft,
                reply_to_message_oid: parent.oid,
            });
            setDraft('');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card border rounded shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
                <header className="border-b p-3 flex justify-between items-center">
                    <h2 className="font-semibold">Thread</h2>
                    <button
                        onClick={onClose}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        Close ✕
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto p-3">
                    <MessageItem
                        message={parent}
                        currentAccountOid={currentAccountOid}
                    />
                    <div className="border-t my-3" />
                    {replies.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                            No replies yet — be the first.
                        </p>
                    ) : (
                        replies.map((r) => (
                            <MessageItem
                                key={r.oid}
                                message={r}
                                currentAccountOid={currentAccountOid}
                            />
                        ))
                    )}
                </div>
                <footer className="border-t p-3 flex gap-2">
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                            if (
                                e.key === 'Enter' &&
                                (e.metaKey || e.ctrlKey)
                            ) {
                                e.preventDefault();
                                onSend();
                            }
                        }}
                        placeholder="Reply in thread…"
                        className="flex-1 border rounded p-2 bg-background min-h-[3rem]"
                    />
                    <button
                        onClick={onSend}
                        disabled={busy || !draft.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
                    >
                        {busy ? '…' : 'Reply'}
                    </button>
                </footer>
            </div>
        </div>
    );
}
