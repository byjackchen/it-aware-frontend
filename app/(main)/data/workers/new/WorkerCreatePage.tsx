'use client';

/**
 * Worker creation page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, User, Save, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Organization, Location, Worker } from '@/lib/types/objects';
import { createWorkerAction } from '@/app/actions/objects';

interface WorkerCreatePageProps {
    organizations: Organization[];
    locations: Location[];
    workers: Worker[];
}

export function WorkerCreatePage({ organizations, locations, workers }: WorkerCreatePageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Required fields
    const [stableId, setStableId] = useState('');
    const [legalFirstName, setLegalFirstName] = useState('');
    const [legalLastName, setLegalLastName] = useState('');
    const [orgOid, setOrgOid] = useState('');

    // Optional fields
    const [preferredFirstName, setPreferredFirstName] = useState('');
    const [email, setEmail] = useState('');
    const [workerId, setWorkerId] = useState('');
    const [locationOid, setLocationOid] = useState('');
    const [managerOid, setManagerOid] = useState('');
    const [gender, setGender] = useState('');
    const [managementLevel, setManagementLevel] = useState('');
    const [professionalLevel, setProfessionalLevel] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate required fields
        if (!stableId.trim() || !legalFirstName.trim() || !legalLastName.trim() || !orgOid) {
            setError('Please fill in all required fields');
            return;
        }

        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('stable_id', stableId.trim());
            formData.set('legal_first_name', legalFirstName.trim());
            formData.set('legal_last_name', legalLastName.trim());
            formData.set('org_oid', orgOid);
            if (preferredFirstName.trim()) formData.set('preferred_first_name', preferredFirstName.trim());
            if (email.trim()) formData.set('email', email.trim());
            if (workerId.trim()) formData.set('worker_id', workerId.trim());
            if (locationOid) formData.set('location_oid', locationOid);
            if (managerOid) formData.set('manager_oid', managerOid);
            if (gender.trim()) formData.set('gender', gender.trim());
            if (managementLevel.trim()) formData.set('management_level', managementLevel.trim());
            if (professionalLevel.trim()) formData.set('professional_level', professionalLevel.trim());
            formData.set('is_active', 'true');

            const result = await createWorkerAction(formData);
            router.push(`/data/workers/${result.oid}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create worker');
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
                        onClick={() => router.push('/data/workers')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                    >
                        <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                            <User className="w-5 h-5" />
                        </div>
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>New Worker</h1>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Required Fields */}
                    <div className="space-y-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Required</h3>

                        <div>
                            <label className={labelClass}>Stable ID *</label>
                            <input
                                type="text"
                                value={stableId}
                                onChange={(e) => setStableId(e.target.value)}
                                placeholder="e.g., WeChat ID or unique identifier"
                                className={inputClass}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Legal First Name *</label>
                                <input
                                    type="text"
                                    value={legalFirstName}
                                    onChange={(e) => setLegalFirstName(e.target.value)}
                                    className={inputClass}
                                    required
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Legal Last Name *</label>
                                <input
                                    type="text"
                                    value={legalLastName}
                                    onChange={(e) => setLegalLastName(e.target.value)}
                                    className={inputClass}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>{t('workers.organization')} *</label>
                            <select
                                value={orgOid}
                                onChange={(e) => setOrgOid(e.target.value)}
                                className={inputClass}
                                required
                            >
                                <option value="">Select organization...</option>
                                {organizations.map((org) => (
                                    <option key={org.oid} value={org.oid}>{org.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Optional Fields */}
                    <div className="space-y-4 pt-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Optional</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Preferred First Name</label>
                                <input
                                    type="text"
                                    value={preferredFirstName}
                                    onChange={(e) => setPreferredFirstName(e.target.value)}
                                    placeholder="Nickname"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>{t('workers.email')}</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>{t('workers.workerId')}</label>
                                <input
                                    type="text"
                                    value={workerId}
                                    onChange={(e) => setWorkerId(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>{t('workers.location')}</label>
                                <select
                                    value={locationOid}
                                    onChange={(e) => setLocationOid(e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">None</option>
                                    {locations.map((loc) => (
                                        <option key={loc.oid} value={loc.oid}>{loc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Manager</label>
                            <select
                                value={managerOid}
                                onChange={(e) => setManagerOid(e.target.value)}
                                className={inputClass}
                            >
                                <option value="">None</option>
                                {workers.map((w) => (
                                    <option key={w.oid} value={w.oid}>
                                        {w.legal_first_name} {w.legal_last_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>Gender</label>
                                <input
                                    type="text"
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Management Level</label>
                                <input
                                    type="text"
                                    value={managementLevel}
                                    onChange={(e) => setManagementLevel(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Professional Level</label>
                                <input
                                    type="text"
                                    value={professionalLevel}
                                    onChange={(e) => setProfessionalLevel(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
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
                            <span>Create Worker</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
