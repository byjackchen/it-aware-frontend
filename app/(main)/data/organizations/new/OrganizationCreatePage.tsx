'use client';

/**
 * Organization creation page client component.
 */

import { useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Building2, Save, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { HierarchySelect, OrganizationTypeSelect } from '@/components/data';
import type { Organization, OrganizationType } from '@/lib/types/objects';
import { createOrganizationAction } from '@/app/actions/objects';

interface OrganizationCreatePageProps {
    organizations: Organization[];
}

export function OrganizationCreatePage({ organizations }: OrganizationCreatePageProps) {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';

    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [type, setType] = useState<OrganizationType>('Team');
    const [stableId, setStableId] = useState('');
    const [parentOid, setParentOid] = useState<string | null>(null);
    const [isActive, setIsActive] = useState(true);
    const [metadataStr, setMetadataStr] = useState('');
    const [metadataError, setMetadataError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!name.trim()) {
            setError('Name is required');
            return;
        }

        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('name', name.trim());
            formData.set('type', type);
            if (stableId.trim()) {
                formData.set('stable_id', stableId.trim());
            }
            if (parentOid) {
                formData.set('parent_oid', parentOid);
            }
            formData.set('is_active', String(isActive));

            if (metadataStr.trim()) {
                try {
                    const parsed = JSON.parse(metadataStr);
                    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
                        throw new Error('Metadata must be a JSON object');
                    }
                    formData.set('metadata', JSON.stringify(parsed));
                } catch (e) {
                    setMetadataError('Invalid JSON format');
                    setIsPending(false);
                    return;
                }
            }

            await createOrganizationAction(formData);
            router.push('/data/organizations');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create organization');
        } finally {
            setIsPending(false);
        }
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/data/organizations')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                    >
                        <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                            <Building2 className="w-5 h-5" />
                        </div>
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            New Organization
                        </h1>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Error Message */}
                    {error && (
                        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Name Field */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter organization name..."
                            className={`
                                w-full px-3 py-2 rounded-lg text-lg
                                ${isLight ? 'bg-slate-100 text-slate-800 placeholder:text-slate-400' : 'bg-white/10 text-white placeholder:text-gray-500'}
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                            `}
                        />
                    </div>

                    {/* Type Field */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-3 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Type <span className="text-red-500">*</span>
                        </label>
                        <OrganizationTypeSelect value={type} onChange={setType} />
                    </div>

                    {/* Stable ID Field */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Stable ID
                        </label>
                        <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Optional external identifier (e.g., Workday org ID)
                        </p>
                        <input
                            type="text"
                            value={stableId}
                            onChange={(e) => setStableId(e.target.value)}
                            placeholder="e.g., 1263"
                            className={`
                                w-full px-3 py-2 rounded-lg
                                ${isLight ? 'bg-slate-100 text-slate-800 placeholder:text-slate-400' : 'bg-white/10 text-white placeholder:text-gray-500'}
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                            `}
                        />
                    </div>

                    {/* Parent Field */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Parent Organization
                        </label>
                        <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Optional. Select a parent organization to create a hierarchy.
                        </p>
                        <HierarchySelect
                            items={organizations}
                            value={parentOid}
                            onChange={setParentOid}
                            placeholder={t('common.noParent')}
                        />
                    </div>


                    {/* Metadata Field */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Metadata (JSON)
                        </label>
                        <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Optional additional data in JSON format
                        </p>
                        <div className="relative">
                            <textarea
                                value={metadataStr}
                                onChange={(e) => {
                                    setMetadataStr(e.target.value);
                                    setMetadataError(null);
                                }}
                                placeholder="{}"
                                rows={6}
                                className={`
                                    w-full px-3 py-2 rounded-lg font-mono text-sm
                                    ${isLight ? 'bg-slate-100 text-slate-800 placeholder:text-slate-400' : 'bg-white/10 text-white placeholder:text-gray-500'}
                                    focus:outline-none focus:ring-2 focus:ring-blue-500/50
                                    ${metadataError ? 'ring-2 ring-red-500/50' : ''}
                                `}
                            />
                            {metadataError && (
                                <div className="absolute top-2 right-2 text-red-500 flex items-center gap-1 bg-white/90 dark:bg-black/90 px-2 py-1 rounded text-xs shadow-sm">
                                    <AlertCircle className="w-3 h-3" />
                                    {metadataError}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status (Active/Inactive) */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Status
                        </label>
                        <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Set to inactive to hide this organization from normal views
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
                        >
                            {isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            <span className="text-sm font-medium">{isActive ? 'Active' : 'Inactive'}</span>
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Create Organization</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/data/organizations')}
                            disabled={isPending}
                            className={`px-6 py-2.5 rounded-lg transition-colors ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
