'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createChannel } from '@/lib/api/channels';

export default function NewChannelPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const c = await createChannel({
                name,
                description: description || null,
                tags: tags
                    ? tags.split(',').map((t) => t.trim()).filter(Boolean)
                    : [],
            });
            router.push(`/agent-ops/channels/${c.oid}`);
        } catch (e: unknown) {
            setError(String((e as Error).message ?? e));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form onSubmit={onSubmit} className="max-w-md p-6 space-y-4">
            <h1 className="text-2xl font-semibold">New Channel</h1>
            <label className="block">
                <span className="text-sm font-medium">Name</span>
                <input
                    className="block w-full border rounded p-2 mt-1"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </label>
            <label className="block">
                <span className="text-sm font-medium">Description (optional)</span>
                <textarea
                    className="block w-full border rounded p-2 mt-1"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </label>
            <label className="block">
                <span className="text-sm font-medium">Tags (comma-separated)</span>
                <input
                    className="block w-full border rounded p-2 mt-1"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                />
            </label>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button
                type="submit"
                disabled={submitting || !name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700"
            >
                {submitting ? 'Creating…' : 'Create Channel'}
            </button>
        </form>
    );
}
