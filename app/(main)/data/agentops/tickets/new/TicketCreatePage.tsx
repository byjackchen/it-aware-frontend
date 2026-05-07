'use client';

/**
 * Ticket creation page client component.
 */

import { useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { ArrowLeft, Ticket as TicketIcon, Loader2, Save } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { createTicketAction } from '@/app/actions/objects';
import type { Account } from '@/lib/types/security';

interface TicketCreatePageProps {
    accounts: Account[];
}

export function TicketCreatePage({ accounts }: TicketCreatePageProps) {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const isLight = theme === 'light';
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [assigneeOid, setAssigneeOid] = useState('');
    const [tags, setTags] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError('Title is required.');
            return;
        }

        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('title', title.trim());
            if (description.trim()) formData.set('description', description.trim());
            if (assigneeOid.trim()) formData.set('assignee_account_oid', assigneeOid.trim());

            const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
            if (tagList.length > 0) formData.set('tags', JSON.stringify(tagList));

            await createTicketAction(formData);
            router.push('/data/agentops/tickets');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create ticket.');
        } finally {
            setIsPending(false);
        }
    };

    const inputClass = `w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`;
    const labelClass = `block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/data/agentops/tickets')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                    >
                        <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                            <TicketIcon className="w-5 h-5" />
                        </div>
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>New Ticket</h1>
                    </div>
                </div>

                <form onSubmit={(e) => void handleSubmit(e)} className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Required</h3>

                        <div>
                            <label className={labelClass}>Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className={inputClass}
                                placeholder="e.g. Fix login bug on mobile"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Optional</h3>

                        <div>
                            <label className={labelClass}>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className={inputClass}
                                placeholder="Describe the ticket in detail..."
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Assignee</label>
                            <select
                                value={assigneeOid}
                                onChange={(e) => setAssigneeOid(e.target.value)}
                                className={inputClass}
                            >
                                <option value="">Unassigned</option>
                                {accounts.map(account => (
                                    <option key={account.oid} value={account.oid}>
                                        {account.username} ({account.account_type})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Tags (comma-separated)</label>
                            <input
                                type="text"
                                value={tags}
                                onChange={(e) => setTags(e.target.value)}
                                className={inputClass}
                                placeholder="e.g. bug, urgent, frontend"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 transition-colors"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Create Ticket</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/data/agentops/tickets')}
                            disabled={isPending}
                            className={`px-4 py-2 rounded-lg transition-colors ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/10 text-gray-300 hover:bg-white/15'}`}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
