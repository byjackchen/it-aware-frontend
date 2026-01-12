'use client';

/**
 * Service Catalog creation page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Layers, Save, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { HierarchySelect } from '@/components/data';
import type { ServiceCatalog } from '@/lib/types/objects';
import { createServiceCatalogAction } from '@/app/actions/objects';

interface ServiceCatalogCreatePageProps {
    serviceCatalogs: ServiceCatalog[];
}

export function ServiceCatalogCreatePage({ serviceCatalogs }: ServiceCatalogCreatePageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';

    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [stableId, setStableId] = useState('');
    const [parentOid, setParentOid] = useState<string | null>(null);
    const [isActive, setIsActive] = useState(true);

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
            if (stableId.trim()) {
                formData.set('stable_id', stableId.trim());
            }
            if (parentOid) {
                formData.set('parent_oid', parentOid);
            }
            formData.set('is_active', String(isActive));

            await createServiceCatalogAction(formData);
            router.push('/data/service-catalogs');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create service catalog');
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
                        onClick={() => router.push('/data/service-catalogs')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                    >
                        <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                            <Layers className="w-5 h-5" />
                        </div>
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            New Service Catalog
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
                            placeholder="Enter service catalog name..."
                            className={`
                                w-full px-3 py-2 rounded-lg text-lg
                                ${isLight ? 'bg-slate-100 text-slate-800 placeholder:text-slate-400' : 'bg-white/10 text-white placeholder:text-gray-500'}
                                focus:outline-none focus:ring-2 focus:ring-purple-500/50
                            `}
                        />
                    </div>

                    {/* Stable ID Field */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Stable ID
                        </label>
                        <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Optional external identifier (e.g., a numeric ID from ServiceNow)
                        </p>
                        <input
                            type="text"
                            value={stableId}
                            onChange={(e) => setStableId(e.target.value)}
                            placeholder="e.g., 12345"
                            className={`
                                w-full px-3 py-2 rounded-lg
                                ${isLight ? 'bg-slate-100 text-slate-800 placeholder:text-slate-400' : 'bg-white/10 text-white placeholder:text-gray-500'}
                                focus:outline-none focus:ring-2 focus:ring-purple-500/50
                            `}
                        />
                    </div>

                    {/* Parent Field */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Parent Service Catalog
                        </label>
                        <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Optional. Select a parent to create a hierarchy.
                        </p>
                        <HierarchySelect
                            items={serviceCatalogs}
                            value={parentOid}
                            onChange={setParentOid}
                            placeholder={t('common.noParent')}
                        />
                    </div>

                    {/* Status (Active/Inactive) */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Status
                        </label>
                        <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Set to inactive to hide this service catalog from normal views
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
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors disabled:opacity-50"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Create Service Catalog</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/data/service-catalogs')}
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
