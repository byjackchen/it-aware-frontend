'use client';

/**
 * Location creation page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, MapPin, Save, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { HierarchySelect, LocationTypeSelect, TimezoneSelect } from '@/components/data';
import type { Location, LocationType } from '@/lib/types/objects';
import { createLocationAction } from '@/app/actions/objects';

interface LocationCreatePageProps {
    locations: Location[];
}

export function LocationCreatePage({ locations }: LocationCreatePageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';

    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [type, setType] = useState<LocationType>('office_location');
    const [timezone, setTimezone] = useState('');
    const [stableId, setStableId] = useState('');
    const [parentOid, setParentOid] = useState<string | null>(null);
    const [isActive, setIsActive] = useState(true);

    // Determine if timezone should be required based on type
    const requiresTimezone = type === 'office_location' || type === 'remote_location';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!name.trim()) {
            setError('Name is required');
            return;
        }
        if (requiresTimezone && !timezone) {
            setError('Timezone is required for office and remote locations');
            return;
        }

        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('name', name.trim());
            formData.set('type', type);
            formData.set('timezone', timezone);
            if (stableId.trim()) {
                formData.set('stable_id', stableId.trim());
            }
            if (parentOid) {
                formData.set('parent_oid', parentOid);
            }
            formData.set('is_active', String(isActive));

            await createLocationAction(formData);
            router.push('/data/locations');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create location');
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
                        onClick={() => router.push('/data/locations')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                    >
                        <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                            <MapPin className="w-5 h-5" />
                        </div>
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            New Location
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
                            placeholder="Enter location name..."
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
                        <LocationTypeSelect value={type} onChange={setType} />
                    </div>

                    {/* Timezone Field */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Timezone {requiresTimezone && <span className="text-red-500">*</span>}
                        </label>
                        <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            {requiresTimezone
                                ? 'Select the timezone for this office or remote location.'
                                : 'Timezone is optional for regions and countries. Leave empty if not applicable.'}
                        </p>
                        <TimezoneSelect
                            value={timezone}
                            onChange={setTimezone}
                            allowEmpty={!requiresTimezone}
                        />
                    </div>

                    {/* Stable ID Field */}
                    <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            Stable ID
                        </label>
                        <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Optional external identifier (e.g., a slugified name like &quot;us-california-palo-alto&quot;)
                        </p>
                        <input
                            type="text"
                            value={stableId}
                            onChange={(e) => setStableId(e.target.value)}
                            placeholder="e.g., us-california-palo-alto"
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
                            Parent Location
                        </label>
                        <p className={`text-xs mb-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Optional. Select a parent location to create a hierarchy.
                        </p>
                        <HierarchySelect
                            items={locations}
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
                            Set to inactive to hide this location from normal views
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
                            <span>Create Location</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/data/locations')}
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
