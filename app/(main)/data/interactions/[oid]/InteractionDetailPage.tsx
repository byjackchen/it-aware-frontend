'use client';

/**
 * Interaction detail page client component (read-only v1).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    MousePointerClick,
    Trash2,
    Loader2,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { Interaction } from '@/lib/types/objects';
import { deleteInteractionAction } from '@/app/actions/objects';

interface InteractionDetailPageProps {
    interaction: Interaction;
}

function getStatusLabel(status: Interaction['assignment_status']): string {
    if (!status) return 'unassigned';
    return status;
}

function formatJson(value: Record<string, unknown> | null): string {
    if (!value) return 'null';
    return JSON.stringify(value, null, 2);
}

export function InteractionDetailPage({ interaction }: InteractionDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isPending, setIsPending] = useState(false);

    const statusLabel = getStatusLabel(interaction.assignment_status);

    const STATUS_STYLE: Record<'assigned' | 'deferred' | 'unassigned', { bg: string; text: string }> = {
        assigned: { bg: 'bg-green-500/20', text: 'text-green-500' },
        deferred: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
        unassigned: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
    };
    const statusStyle = STATUS_STYLE[statusLabel as 'assigned' | 'deferred' | 'unassigned'];

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this interaction?')) return;
        setIsPending(true);
        try {
            await deleteInteractionAction(interaction.oid);
            router.push('/data/interactions');
        } catch (error) {
            console.error('Failed to delete interaction:', error);
            alert('Failed to delete interaction');
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/interactions')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                <MousePointerClick className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Interaction Details</h1>
                                <p className={`text-sm font-mono ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{interaction.stable_id}</p>
                            </div>
                        </div>
                    </div>

                    <div className={`text-xs px-2 py-1 rounded-full capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                        {statusLabel}
                    </div>
                </div>

                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">OID</span>
                            <span className="font-mono text-xs break-all">{interaction.oid}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Stable ID</span>
                            <span className="font-mono text-xs break-all">{interaction.stable_id}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Action Type</span>
                            <span className="text-sm">{interaction.action_type}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Source System</span>
                            <span className="text-sm">{interaction.source_system}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Actor Stable ID</span>
                            <span className="text-sm">{interaction.actor_stable_id}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Assigned Inquiry OID</span>
                            {interaction.assigned_inquiry_oid ? (
                                <Link href={`/data/inquiries/${interaction.assigned_inquiry_oid}`} className="underline underline-offset-4 text-sm">
                                    {interaction.assigned_inquiry_oid}
                                </Link>
                            ) : (
                                <span className="text-sm opacity-60">—</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Content Text</span>
                        <div className={`p-3 rounded-lg whitespace-pre-wrap ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                            {interaction.content_text || <span className="italic opacity-50">No content text</span>}
                        </div>
                    </div>

                    <div>
                        <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Response Text</span>
                        <div className={`p-3 rounded-lg whitespace-pre-wrap ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                            {interaction.response_text || <span className="italic opacity-50">No response text</span>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Content Raw (JSON)</span>
                            <div className={`p-4 rounded-lg overflow-x-auto ${isLight ? 'bg-slate-50' : 'bg-black/20'}`}>
                                <pre className={`text-xs font-mono ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatJson(interaction.content_raw)}</pre>
                            </div>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Response Raw (JSON)</span>
                            <div className={`p-4 rounded-lg overflow-x-auto ${isLight ? 'bg-slate-50' : 'bg-black/20'}`}>
                                <pre className={`text-xs font-mono ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatJson(interaction.response_raw)}</pre>
                            </div>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Assignment Log (JSON)</span>
                            <div className={`p-4 rounded-lg overflow-x-auto ${isLight ? 'bg-slate-50' : 'bg-black/20'}`}>
                                <pre className={`text-xs font-mono ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatJson(interaction.assignment_log)}</pre>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-dashed border-slate-200 dark:border-white/10">
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Created At</span>
                            <span className="text-sm">{formatDateTime(interaction.created_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Ingested At</span>
                            <span className="text-sm">{formatDateTime(interaction.ingested_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Updated At</span>
                            <span className="text-sm">{formatDateTime(interaction.updated_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Assignment Updated At</span>
                            <span className="text-sm">{formatDateTime(interaction.assignment_updated_at, timezone)}</span>
                        </div>
                    </div>

                    <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                        <button onClick={handleDelete} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            <span>Delete Interaction</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
