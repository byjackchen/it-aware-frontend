'use client';

import { useState } from 'react';
import { updateChannel } from '@/lib/api/channels';
import type { Channel } from '@/lib/api/channels';

interface Props {
    channel: Channel;
    onClose: () => void;
    onSaved: (updated: Channel) => void;
}

export function EditChannelDialog({ channel, onClose, onSaved }: Props) {
    const [name, setName] = useState(channel.name);
    const [description, setDescription] = useState(channel.description ?? '');
    const [tagsStr, setTagsStr] = useState(channel.tags.join(', '));
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSave() {
        setBusy(true);
        setError(null);
        try {
            const tags = tagsStr
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);
            const updated = await updateChannel(channel.oid, {
                name,
                description: description || null,
                tags,
            });
            onSaved(updated);
            onClose();
        } catch (e: unknown) {
            setError(String((e as Error).message ?? e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-card border rounded shadow-lg w-full max-w-md p-4 space-y-3">
                <div className="flex justify-between items-center">
                    <h2 className="font-semibold">Edit channel</h2>
                    <button
                        onClick={onClose}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        ✕
                    </button>
                </div>
                <label className="block text-sm">
                    Name
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="block w-full border rounded p-2 mt-1 bg-background"
                    />
                </label>
                <label className="block text-sm">
                    Description
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="block w-full border rounded p-2 mt-1 bg-background min-h-[4rem]"
                    />
                </label>
                <label className="block text-sm">
                    Tags (comma-separated)
                    <input
                        value={tagsStr}
                        onChange={(e) => setTagsStr(e.target.value)}
                        className="block w-full border rounded p-2 mt-1 bg-background"
                    />
                </label>
                {error && (
                    <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 rounded hover:bg-muted"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSave}
                        disabled={busy || !name.trim()}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
                    >
                        {busy ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
