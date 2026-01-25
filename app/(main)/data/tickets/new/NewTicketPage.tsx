'use client';

/**
 * Ticket creation page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Ticket, Save, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Worker } from '@/lib/types/objects';
import { createTicketAction } from '@/app/actions/objects';

interface NewTicketPageProps {
    workers: Worker[];
}

const STATUS_OPTIONS = ['open', 'in_progress', 'pending', 'resolved', 'closed'];

export function NewTicketPage({ workers }: NewTicketPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [status, setStatus] = useState('open');
    const [requesterOid, setRequesterOid] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim()) {
            setError(t('tickets.titleRequired'));
            return;
        }

        if (!requesterOid) {
            setError('Please select a requester');
            return;
        }

        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('title', title.trim());
            formData.set('status', status);
            formData.set('requester_oid', requesterOid);
            formData.set('is_active', 'true');

            const result = await createTicketAction(formData);
            router.push(`/data/tickets/${result.oid}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create ticket');
        } finally {
            setIsPending(false);
        }
    };

    const inputClass = `w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`;
    const labelClass = `block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/data/tickets')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                    >
                        <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                            <Ticket className="w-5 h-5" />
                        </div>
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('tickets.new')}</h1>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className={labelClass}>{t('tickets.ticketTitle')} *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className={inputClass}
                            placeholder="e.g. Broken Laptop"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>{t('tickets.status')}</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className={inputClass}
                            >
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Requester *</label>
                            <select
                                value={requesterOid}
                                onChange={(e) => setRequesterOid(e.target.value)}
                                className={inputClass}
                                required
                            >
                                <option value="">Select requester...</option>
                                {workers.map((w) => (
                                    <option key={w.oid} value={w.oid}>
                                        {w.fullname}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50 transition-colors"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>{t('common.save')}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
