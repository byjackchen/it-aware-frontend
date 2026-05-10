'use client';

/**
 * System detail page client component.
 *
 * Mirrors AgentDetailPage with two key differences:
 *   - contact_worker_oid is nullable (infrastructure systems can be ownerless)
 *   - no agent_key / admin_key / workspace_id fields
 */

import { useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { ArrowLeft, Cpu, Pencil, Save, Trash2, Loader2, X } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { System, Worker } from '@/lib/types/objects';
import { updateSystemAction, deleteSystemAction } from '@/app/actions/objects';

interface SystemDetailPageProps {
    system: System;
    workers: Worker[];
}

export function SystemDetailPage({ system, workers }: SystemDetailPageProps) {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const [name, setName] = useState(system.name);
    const [systemPlatform, setSystemPlatform] = useState(system.system_platform);
    const [contactWorkerOid, setContactWorkerOid] = useState(system.contact_worker_oid || '');
    const [accountOid, setAccountOid] = useState(system.account_oid || '');
    const [description, setDescription] = useState(system.description || '');
    const [isActive, setIsActive] = useState(system.is_active);

    const contactWorker = workers.find((w) => w.oid === system.contact_worker_oid);
    const contactWorkerDisplay = contactWorker
        ? `${contactWorker.fullname} (${contactWorker.stable_id})`
        : (system.contact_worker_oid || '—');

    const inputClass = `w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`;
    const labelClass = `block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`;
    const valueClass = `text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            if (name) formData.set('name', name);
            if (systemPlatform) formData.set('system_platform', systemPlatform);
            // Allow clearing contact_worker_oid by sending empty string; the action
            // converts '' to undefined which the backend treats as "no change".
            // To explicitly null it, the user would need to use the API directly.
            if (contactWorkerOid) formData.set('contact_worker_oid', contactWorkerOid);
            if (accountOid.trim()) formData.set('account_oid', accountOid.trim());
            if (description.trim()) formData.set('description', description.trim());
            formData.set('is_active', String(isActive));

            await updateSystemAction(system.oid, formData);
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error('Failed to update system:', error);
            alert(error instanceof Error ? error.message : 'Failed to update system');
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this system?')) return;
        setIsPending(true);
        try {
            await deleteSystemAction(system.oid);
            router.push('/data/systems');
        } catch (error) {
            console.error('Failed to delete system:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete system');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setName(system.name);
        setSystemPlatform(system.system_platform);
        setContactWorkerOid(system.contact_worker_oid || '');
        setAccountOid(system.account_oid || '');
        setDescription(system.description || '');
        setIsActive(system.is_active);
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/data/systems')}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                        >
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-cyan-100 text-cyan-600' : 'bg-cyan-500/20 text-cyan-400'}`}>
                                <Cpu className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`} data-testid="system-detail-title">System Details</h1>
                                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`} data-testid="system-stable-id">{system.system_id}</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isEditing ? (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                                    data-testid="system-edit-button"
                                >
                                    <Pencil className="w-4 h-4" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isPending}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                                    data-testid="system-delete-button"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    <span>Delete</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={isPending}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors disabled:opacity-50"
                                    data-testid="system-save-button"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span>Save</span>
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={isPending}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                                >
                                    <X className="w-4 h-4" />
                                    <span>Cancel</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>

                    {/* Name + System ID */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Name</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={inputClass}
                                />
                            ) : (
                                <div className={`text-xl font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{system.name}</div>
                            )}
                        </div>
                        <div>
                            <label className={labelClass}>System ID (readonly)</label>
                            <div className={`px-3 py-2 rounded-lg font-mono text-sm ${isLight ? 'bg-slate-50 text-slate-700 border border-slate-200' : 'bg-white/5 text-gray-300 border border-white/10'}`}>
                                {system.system_id}
                            </div>
                        </div>
                    </div>

                    {/* Platform + Active */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Platform</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={systemPlatform}
                                    onChange={(e) => setSystemPlatform(e.target.value)}
                                    className={inputClass}
                                    placeholder="e.g. ingestion, scheduler, internal"
                                />
                            ) : (
                                <div className={valueClass}>{system.system_platform}</div>
                            )}
                        </div>
                        <div>
                            <label className={labelClass}>Active</label>
                            {isEditing ? (
                                <select
                                    value={String(isActive)}
                                    onChange={(e) => setIsActive(e.target.value === 'true')}
                                    className={inputClass}
                                >
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                </select>
                            ) : (
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${system.is_active
                                    ? (isLight ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400')
                                    : (isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400')
                                }`}>
                                    {system.is_active ? 'Active' : 'Inactive'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Contact Worker (nullable) */}
                    <div>
                        <label className={labelClass}>Contact Worker (optional)</label>
                        {isEditing ? (
                            <select
                                value={contactWorkerOid}
                                onChange={(e) => setContactWorkerOid(e.target.value)}
                                className={inputClass}
                            >
                                <option value="">— None (ownerless system) —</option>
                                {workers.map((worker) => (
                                    <option key={worker.oid} value={worker.oid}>
                                        {worker.fullname} ({worker.stable_id})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className={valueClass}>{contactWorkerDisplay}</div>
                        )}
                    </div>

                    {/* Account OID */}
                    <div>
                        <label className={labelClass}>Account OID</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={accountOid}
                                onChange={(e) => setAccountOid(e.target.value)}
                                className={inputClass}
                                placeholder="Optional account OID"
                            />
                        ) : (
                            <div className={valueClass}>{system.account_oid || '—'}</div>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className={labelClass}>Description</label>
                        {isEditing ? (
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className={inputClass}
                            />
                        ) : (
                            <div className={`p-4 rounded-lg whitespace-pre-wrap ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                {system.description || <span className="italic opacity-50">No description provided</span>}
                            </div>
                        )}
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-dashed border-slate-200 dark:border-white/10">
                        <div>
                            <label className={labelClass}>Created At</label>
                            <div className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{system.created_at}</div>
                        </div>
                        <div>
                            <label className={labelClass}>Updated At</label>
                            <div className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{system.updated_at}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
