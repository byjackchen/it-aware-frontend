'use client';

/**
 * Worker detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    User,
    Trash2,
    Pencil,
    Save,
    Loader2,
    Calendar,
    Building2,
    MapPin,
    Mail,
    Hash,
    Check,
    X,
    Briefcase,
    Users,
    Heart,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph } from '@/components/data';
import type { Worker, GlobalEdge, Organization, Location } from '@/lib/types/objects';
import { getWorkerFullName } from '@/lib/types/objects';
import { updateWorkerAction, deleteWorkerAction } from '@/app/actions/objects';

interface WorkerDetailPageProps {
    worker: Worker;
    edges: GlobalEdge[];
    organizations: Organization[];
    locations: Location[];
}

export function WorkerDetailPage({ worker, edges, organizations, locations }: WorkerDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);

    // Name fields
    const [legalFirstName, setLegalFirstName] = useState(worker.legal_first_name);
    const [legalLastName, setLegalLastName] = useState(worker.legal_last_name);
    const [preferredFirstName, setPreferredFirstName] = useState(worker.preferred_first_name || '');

    // Basic info
    const [email, setEmail] = useState(worker.email || '');
    const [workerId, setWorkerId] = useState(worker.worker_id || '');
    const [locationOid, setLocationOid] = useState(worker.location_oid || '');

    // New optional fields
    const [gender, setGender] = useState(worker.gender || '');
    const [managementLevel, setManagementLevel] = useState(worker.management_level || '');
    const [professionalLevel, setProfessionalLevel] = useState(worker.professional_level || '');

    const [isActive, setIsActive] = useState(worker.is_active);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    const orgName = organizations.find((o) => o.oid === worker.org_oid)?.name || 'Unknown';
    const locationName = worker.location_oid
        ? locations.find((l) => l.oid === worker.location_oid)?.name || 'Unknown'
        : null;
    const filteredEdges = edgeFilter ? edges.filter((e) => e.edge_type === edgeFilter) : edges;
    const fullName = getWorkerFullName(worker);

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('legal_first_name', legalFirstName);
            formData.set('legal_last_name', legalLastName);
            formData.set('preferred_first_name', preferredFirstName);
            formData.set('email', email);
            formData.set('worker_id', workerId);
            formData.set('location_oid', locationOid);
            formData.set('gender', gender);
            formData.set('management_level', managementLevel);
            formData.set('professional_level', professionalLevel);
            formData.set('is_active', String(isActive));
            await updateWorkerAction(worker.oid, formData);
            setIsEditing(false);
            router.refresh();
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('workers.deleteConfirm'))) return;
        setIsPending(true);
        try {
            await deleteWorkerAction(worker.oid);
            router.push('/data/workers');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setLegalFirstName(worker.legal_first_name);
        setLegalLastName(worker.legal_last_name);
        setPreferredFirstName(worker.preferred_first_name || '');
        setEmail(worker.email || '');
        setWorkerId(worker.worker_id || '');
        setLocationOid(worker.location_oid || '');
        setGender(worker.gender || '');
        setManagementLevel(worker.management_level || '');
        setProfessionalLevel(worker.professional_level || '');
        setIsActive(worker.is_active);
        setIsEditing(false);
    };

    const inputClass = `w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`;
    const displayClass = `flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`;
    const labelClass = `block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`;
    const iconClass = `w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`;
    const textClass = `text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
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
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('workers.detail')}</h1>
                        </div>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                        >
                            <Pencil className="w-4 h-4" />
                            <span>{t('common.edit')}</span>
                        </button>
                    )}
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Name Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Legal First Name */}
                        <div>
                            <label className={labelClass}>{t('workers.legalFirstName')}</label>
                            {isEditing ? (
                                <input type="text" value={legalFirstName} onChange={(e) => setLegalFirstName(e.target.value)} className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <User className={iconClass} />
                                    <span className={textClass}>{worker.legal_first_name}</span>
                                </div>
                            )}
                        </div>

                        {/* Legal Last Name */}
                        <div>
                            <label className={labelClass}>{t('workers.legalLastName')}</label>
                            {isEditing ? (
                                <input type="text" value={legalLastName} onChange={(e) => setLegalLastName(e.target.value)} className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <User className={iconClass} />
                                    <span className={textClass}>{worker.legal_last_name}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Preferred Name */}
                        <div>
                            <label className={labelClass}>{t('workers.preferredFirstName')}</label>
                            {isEditing ? (
                                <input type="text" value={preferredFirstName} onChange={(e) => setPreferredFirstName(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Heart className={iconClass} />
                                    <span className={textClass}>{worker.preferred_first_name || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>

                        {/* Full Name (Display only) */}
                        <div>
                            <label className={labelClass}>{t('workers.fullName')}</label>
                            <div className={`px-3 py-2 rounded-lg text-lg ${isLight ? 'text-slate-800 bg-slate-50' : 'text-white bg-white/5'}`}>
                                {fullName}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Email */}
                        <div>
                            <label className={labelClass}>{t('workers.email')}</label>
                            {isEditing ? (
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('workers.notSet')} className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Mail className={iconClass} />
                                    <span className={textClass}>{worker.email || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>

                        {/* Worker ID */}
                        <div>
                            <label className={labelClass}>{t('workers.workerId')}</label>
                            {isEditing ? (
                                <input type="text" value={workerId} onChange={(e) => setWorkerId(e.target.value)} placeholder={t('workers.notSet')} className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Hash className={iconClass} />
                                    <span className={textClass}>{worker.worker_id || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stable ID (read-only) */}
                    <div>
                        <label className={labelClass}>{t('workers.stableId')}</label>
                        <div className={displayClass}>
                            <Hash className={iconClass} />
                            <span className={textClass}>{worker.stable_id}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Organization */}
                        <div>
                            <label className={labelClass}>{t('workers.organization')}</label>
                            <div className={displayClass}>
                                <Building2 className={iconClass} />
                                <span className={textClass}>{orgName}</span>
                            </div>
                        </div>

                        {/* Location */}
                        <div>
                            <label className={labelClass}>{t('workers.location')}</label>
                            {isEditing ? (
                                <select
                                    value={locationOid}
                                    onChange={(e) => setLocationOid(e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">{t('workers.notSet')}</option>
                                    {locations.map((loc) => (
                                        <option key={loc.oid} value={loc.oid}>{loc.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className={displayClass}>
                                    <MapPin className={iconClass} />
                                    <span className={textClass}>{locationName || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        {/* Gender */}
                        <div>
                            <label className={labelClass}>{t('workers.gender')}</label>
                            {isEditing ? (
                                <input type="text" value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <User className={iconClass} />
                                    <span className={textClass}>{worker.gender || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>

                        {/* Management Level */}
                        <div>
                            <label className={labelClass}>{t('workers.managementLevel')}</label>
                            {isEditing ? (
                                <input type="text" value={managementLevel} onChange={(e) => setManagementLevel(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Users className={iconClass} />
                                    <span className={textClass}>{worker.management_level || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>

                        {/* Professional Level */}
                        <div>
                            <label className={labelClass}>{t('workers.professionalLevel')}</label>
                            {isEditing ? (
                                <input type="text" value={professionalLevel} onChange={(e) => setProfessionalLevel(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{worker.professional_level || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Status Row */}
                    <div>
                        <label className={labelClass}>{t('workers.status')}</label>
                        {isEditing ? (
                            <label className="flex items-center gap-2 px-3 py-2">
                                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
                                <span className={isLight ? 'text-slate-700' : 'text-gray-300'}>{t('workers.active')}</span>
                            </label>
                        ) : (
                            <div className={displayClass}>
                                {worker.is_active ? (
                                    <span className="flex items-center gap-1 text-green-500"><Check className="w-4 h-4" /> {t('workers.active')}</span>
                                ) : (
                                    <span className="flex items-center gap-1 text-red-500"><X className="w-4 h-4" /> {t('workers.inactive')}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>{t('common.created')}</label>
                            <div className={displayClass}>
                                <Calendar className={iconClass} />
                                <span className={textClass}>{new Date(worker.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>{t('common.updated')}</label>
                            <div className={displayClass}>
                                <Calendar className={iconClass} />
                                <span className={textClass}>{new Date(worker.updated_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {isEditing ? (
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>{t('common.save')}</span>
                            </button>
                            <button onClick={handleCancel} disabled={isPending} className={`px-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>{t('common.cancel')}</button>
                        </div>
                    ) : (
                        <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                            <button onClick={handleDelete} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span>{t('common.delete')} {t('workers.title')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('common.edgeRelationships')}</h2>
                    <ObjectGraph
                        oid={worker.oid}
                        objectType="worker"
                        descriptor={fullName}
                        edges={filteredEdges}
                        onFilterChange={setEdgeFilter}
                        selectedFilter={edgeFilter}
                    />
                </div>
            </div>
        </div>
    );
}
