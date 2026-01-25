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
    Laptop,
    Monitor,
    Smartphone,
    Mouse,
    Keyboard,
    Headphones,
    Box,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph } from '@/components/data';
import type { Worker, GlobalEdge, Organization, Location, WorkerHardware } from '@/lib/types/objects';
import { updateWorkerAction, deleteWorkerAction } from '@/app/actions/objects';

interface WorkerDetailPageProps {
    worker: Worker;
    edges: GlobalEdge[];
    organizations: Organization[];
    locations: Location[];
    hardwares: WorkerHardware[];
}

export function WorkerDetailPage({ worker, edges, organizations, locations, hardwares }: WorkerDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);

    // Name field
    const [fullname, setFullname] = useState(worker.fullname);

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
    const filteredEdges = edgeFilter ? edges.filter((e) => {
        const connectedObject = e.from_oid === worker.oid ? e.to_object : e.from_object;
        return connectedObject?.object_type === edgeFilter;
    }) : edges;
    const fullName = worker.fullname;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('fullname', fullname);
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
        setFullname(worker.fullname);
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
                    {/* Full Name */}
                    <div>
                        <label className={labelClass}>{t('workers.fullname')}</label>
                        {isEditing ? (
                            <input type="text" value={fullname} onChange={(e) => setFullname(e.target.value)} className={inputClass} />
                        ) : (
                            <div className={`px-3 py-2 rounded-lg text-lg ${isLight ? 'text-slate-800 bg-slate-50' : 'text-white bg-white/5'}`}>
                                {worker.fullname}
                            </div>
                        )}
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

                {/* Hardware Assets */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('workers.hardware.title')}</h2>

                    {hardwares.length === 0 ? (
                        <div className={`text-center py-8 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            {t('workers.hardware.empty')}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {hardwares.map((hw: WorkerHardware) => {
                                const isRenewable = hw.renew_eligible_date ? new Date(hw.renew_eligible_date) <= new Date() : false;
                                let Icon = Box;
                                const type = hw.hardware_type.toLowerCase();
                                if (type.includes('laptop') || type.includes('macbook') || type.includes('notebook')) Icon = Laptop;
                                else if (type.includes('monitor') || type.includes('display') || type.includes('screen')) Icon = Monitor;
                                else if (type.includes('phone') || type.includes('mobile') || type.includes('iphone')) Icon = Smartphone;
                                else if (type.includes('mouse')) Icon = Mouse;
                                else if (type.includes('keyboard')) Icon = Keyboard;
                                else if (type.includes('headset') || type.includes('headphone')) Icon = Headphones;

                                return (
                                    <div key={hw.oid} className={`p-4 rounded-lg border ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-white/5'}`}>
                                        <div className="flex items-start justify-between">
                                            <div className="flex gap-4">
                                                <div className={`p-3 rounded-lg ${isLight ? 'bg-white text-slate-600' : 'bg-white/10 text-gray-300'}`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h3 className={`font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                        {hw.hardware_type} - {hw.model || t('workers.hardware.unknown')}
                                                    </h3>
                                                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm">
                                                        {hw.serial_number && (
                                                            <span className={isLight ? 'text-slate-500' : 'text-gray-400'}>
                                                                <span className="font-medium mr-1">{t('workers.hardware.serial')}:</span>
                                                                {hw.serial_number}
                                                            </span>
                                                        )}
                                                        {hw.tracking_id && (
                                                            <span className={isLight ? 'text-slate-500' : 'text-gray-400'}>
                                                                <span className="font-medium mr-1">{t('workers.hardware.trackingId')}:</span>
                                                                {hw.tracking_id}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1 text-sm">
                                                        <span className={isLight ? 'text-slate-500' : 'text-gray-400'}>
                                                            <span className="font-medium mr-1">{t('workers.hardware.assigned')}:</span>
                                                            {new Date(hw.assignment_date).toLocaleDateString()}
                                                        </span>
                                                        {hw.renew_eligible_date && (
                                                            <span className={`${isRenewable ? 'text-green-600 font-medium' : isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                                {isRenewable && <Check className="w-3 h-3 inline mr-1" />}
                                                                <span className="font-medium mr-1">{t('workers.hardware.renew')}:</span>
                                                                {new Date(hw.renew_eligible_date).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {hw.is_active ? (
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                                    {t('workers.hardware.active')}
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                                    {t('workers.inactive')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
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
                        allEdges={edges}
                        onFilterChange={setEdgeFilter}
                        selectedFilter={edgeFilter}
                    />
                </div>
            </div>
        </div>
    );
}
