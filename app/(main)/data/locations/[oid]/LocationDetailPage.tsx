'use client';

/**
 * Location detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    MapPin,
    Trash2,
    Pencil,
    Save,
    Loader2,
    Calendar,
    GitBranch,
    Globe,
    Building2,
    Home,
    Clock,
    Hash,
    CheckCircle,
    XCircle,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph, RoleWorkerAssignment, HierarchySelect, LocationTypeSelect, TimezoneSelect } from '@/components/data';
import type { Location, LocationType, GlobalEdge, WorkerHierarchyRole, Worker } from '@/lib/types/objects';
import type { Role } from '@/lib/types/security';
import { updateLocationAction, deleteLocationAction, assignWorkerRoleAction, removeWorkerRoleAction } from '@/app/actions/objects';

interface LocationDetailPageProps {
    location: Location;
    locations: Location[];
    edges: GlobalEdge[];
    assignments: WorkerHierarchyRole[];
    workers: Worker[];
    roles: Role[];
}

// Location type display configuration
const LOCATION_TYPE_CONFIG: Record<LocationType, { label: string; icon: typeof Globe; color: string }> = {
    'Root': { label: 'Root', icon: Globe, color: 'text-purple-500' },
    'Region': { label: 'Region', icon: Globe, color: 'text-blue-500' },
    'Country': { label: 'Country', icon: MapPin, color: 'text-green-500' },
    'Office Location': { label: 'Office', icon: Building2, color: 'text-orange-500' },
    'Remote Location': { label: 'Remote', icon: Home, color: 'text-cyan-500' },
};

export function LocationDetailPage({
    location,
    locations,
    edges,
    assignments,
    workers,
    roles,
}: LocationDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [name, setName] = useState(location.name);
    const [type, setType] = useState<LocationType>(location.type);
    const [timezone, setTimezone] = useState(location.timezone);
    const [stableId, setStableId] = useState(location.stable_id || '');
    const [parentOid, setParentOid] = useState<string | null>(location.parent_oid);
    const [isActive, setIsActive] = useState(location.is_active);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    // Get parent name for display
    const parentName = location.parent_oid
        ? locations.find((l) => l.oid === location.parent_oid)?.name
        : null;

    const filteredEdges = edgeFilter ? edges.filter((e) => {
        const connectedObject = e.from_oid === location.oid ? e.to_object : e.from_object;
        return connectedObject?.object_type === edgeFilter;
    }) : edges;

    // Get type display config
    const typeConfig = LOCATION_TYPE_CONFIG[location.type] || LOCATION_TYPE_CONFIG['Office Location'];
    const TypeIcon = typeConfig.icon;

    // Determine if timezone is required based on type
    const requiresTimezone = type === 'Office Location' || type === 'Remote Location';

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('name', name);
            formData.set('type', type);
            formData.set('timezone', timezone);
            formData.set('stable_id', stableId);
            formData.set('is_active', String(isActive));
            if (parentOid !== location.parent_oid) {
                formData.set('parent_oid', parentOid || '');
            }
            await updateLocationAction(location.oid, formData);
            setIsEditing(false);
            router.refresh();
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('locations.deleteConfirm'))) return;
        setIsPending(true);
        try {
            await deleteLocationAction(location.oid);
            router.push('/data/locations');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setName(location.name);
        setType(location.type);
        setTimezone(location.timezone);
        setStableId(location.stable_id || '');
        setParentOid(location.parent_oid);
        setIsActive(location.is_active);
        setIsEditing(false);
    };

    const handleAssignRole = async (workerOid: string, roleOid: string) => {
        await assignWorkerRoleAction(workerOid, roleOid, location.oid);
    };

    const handleRemoveRole = async (workerOid: string, roleOid: string) => {
        await removeWorkerRoleAction(workerOid, roleOid, location.oid);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
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
                                {t('locations.detail')}
                            </h1>
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

                    {/* Status Badge */}
                    {!isEditing && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${location.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {location.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            {location.is_active ? 'Active' : 'Inactive'}
                        </div>
                    )}
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Name */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            {t('common.name')}
                        </label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg text-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`}
                            />
                        ) : (
                            <div className={`px-3 py-2 rounded-lg text-lg ${isLight ? 'text-slate-800 bg-slate-50' : 'text-white bg-white/5'}`}>
                                {location.name}
                            </div>
                        )}
                    </div>

                    {/* Type */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Type
                        </label>
                        {isEditing ? (
                            <LocationTypeSelect value={type} onChange={setType} />
                        ) : (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {typeConfig.label}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Timezone */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Timezone
                        </label>
                        {isEditing ? (
                            <TimezoneSelect
                                value={timezone}
                                onChange={setTimezone}
                                allowEmpty={!requiresTimezone}
                            />
                        ) : (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Clock className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {location.timezone || 'No timezone specified'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Stable ID */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Stable ID
                        </label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={stableId}
                                onChange={(e) => setStableId(e.target.value)}
                                placeholder="External identifier (optional)"
                                className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800 placeholder:text-slate-400' : 'bg-white/10 text-white placeholder:text-gray-500'}`}
                            />
                        ) : (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Hash className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {location.stable_id || '—'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Parent */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            {t('common.parent')}
                        </label>
                        {isEditing ? (
                            <HierarchySelect
                                items={locations}
                                value={parentOid}
                                onChange={setParentOid}
                                excludeOid={location.oid}
                            />
                        ) : (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <MapPin className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {parentName || t('common.noParent')}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Path */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            {t('common.hierarchyPath')}
                        </label>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                            <GitBranch className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                {location.path.length === 1
                                    ? t('common.levelsDeep', { count: location.path.length })
                                    : t('common.levelsDeepPlural', { count: location.path.length })}
                            </span>
                        </div>
                    </div>

                    {/* Status (Active/Inactive) */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Status
                        </label>
                        {isEditing ? (
                            <button
                                type="button"
                                onClick={() => setIsActive(!isActive)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
                            >
                                {isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                <span className="text-sm font-medium">{isActive ? 'Active' : 'Inactive'}</span>
                            </button>
                        ) : (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                {location.is_active ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                                <span className={`text-sm ${location.is_active ? 'text-green-400' : 'text-red-400'}`}>
                                    {location.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                {t('common.created')}
                            </label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {new Date(location.created_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                {t('common.updated')}
                            </label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {new Date(location.updated_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Edit Actions */}
                    {isEditing && (
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleSave}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>{t('common.save')}</span>
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className={`px-4 py-2 rounded-lg transition-colors ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    )}

                    {/* Delete */}
                    {!isEditing && (
                        <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                            <button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span>{t('common.delete')} {t('locations.title')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Role Assignments */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {t('common.roleAssignments')}
                    </h2>
                    <RoleWorkerAssignment
                        hierarchyOid={location.oid}
                        roles={roles}
                        workers={workers}
                        assignments={assignments}
                        onAssign={handleAssignRole}
                        onRemove={handleRemoveRole}
                    />
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {t('common.edgeRelationships')}
                    </h2>
                    <ObjectGraph
                        oid={location.oid}
                        objectType="location"
                        descriptor={location.name}
                        edges={filteredEdges}
                        onFilterChange={setEdgeFilter}
                        selectedFilter={edgeFilter}
                    />
                </div>
            </div>
        </div>
    );
}
