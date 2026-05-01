'use client';

/**
 * Worker detail page client component.
 */

import { useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
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
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
import { ObjectGraph } from '@/components/data';
import { formatDate, formatDateTime } from '@/lib/utils/datetime';
import type { Worker, WorkerProfile, WorkerProfileUpsert, WorkerProfileTopicItem, GlobalEdge, Organization, Location } from '@/lib/types/objects';
import { updateWorkerAction, upsertWorkerProfileAction, deleteWorkerAction } from '@/app/actions/objects';

interface WorkerDetailPageProps {
    worker: Worker;
    workerProfile: WorkerProfile | null;
    edges: GlobalEdge[];
    organizations: Organization[];
    locations: Location[];
}

function normalizeSummary(text: string): string | null {
    const trimmed = text.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function parseCommaList(text: string): string[] | null {
    const uniqueValues = new Set<string>();

    text.split(',').forEach((value) => {
        const trimmed = value.trim();
        if (trimmed) {
            uniqueValues.add(trimmed);
        }
    });

    const values = Array.from(uniqueValues);
    return values.length > 0 ? values : null;
}

function areStringArraysEqual(a: string[] | null, b: string[] | null): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function areTopicsEqual(a: WorkerProfileTopicItem[] | null, b: WorkerProfileTopicItem[] | null): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a.length !== b.length) return false;
    return JSON.stringify(a) === JSON.stringify(b);
}

function formatCommaList(values: string[] | null): string {
    if (!values || values.length === 0) return '';
    return values.join(', ');
}

function emptyTopicItem(): WorkerProfileTopicItem {
    return { topic: '', need: '', status: 'unresolved', notes: null };
}

export function WorkerDetailPage({ worker, workerProfile, edges, organizations, locations }: WorkerDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useTransitionRouter();
    const t = useTranslations('Data');
    const { hasPermission } = usePermissions();
    const canReadSensitive = hasPermission(PERMISSIONS.OBJECTS.WORKERS_READ_SENSITIVE);
    const canEditSensitive = hasPermission(PERMISSIONS.OBJECTS.WORKERS_EDIT_SENSITIVE);
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [profile, setProfile] = useState<WorkerProfile | null>(workerProfile);
    const [isProfileEditing, setIsProfileEditing] = useState(false);
    const [isProfilePending, setIsProfilePending] = useState(false);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Name field
    const [fullname, setFullname] = useState(worker.fullname);

    // Basic info
    const [email, setEmail] = useState(worker.email || '');
    const [workerId, setWorkerId] = useState(worker.worker_id || '');
    const [locationOid, setLocationOid] = useState(worker.location_oid || '');

    // New optional fields
    const [gender, setGender] = useState(worker.gender || '');
    const [workerType, setWorkerType] = useState(worker.worker_type || '');
    const [jobCategory, setJobCategory] = useState(worker.job_category || '');
    const [jobSubcategory, setJobSubcategory] = useState(worker.job_subcategory || '');
    const [jobProfessionalLevel, setJobProfessionalLevel] = useState(worker.job_professional_level || '');
    const [jobManagementLevel, setJobManagementLevel] = useState(worker.job_management_level || '');
    const [jobBand, setJobBand] = useState(worker.job_band || '');
    const [jobTitle, setJobTitle] = useState(worker.job_title || '');
    const [isVip, setIsVip] = useState(worker.is_vip);
    const [vipType, setVipType] = useState(worker.vip_type || '');
    const [profileSummaryText, setProfileSummaryText] = useState(workerProfile?.summary || '');
    const [profileTopicsDraft, setProfileTopicsDraft] = useState<WorkerProfileTopicItem[]>(workerProfile?.topics || []);
    const [profileTagsText, setProfileTagsText] = useState(formatCommaList(workerProfile?.tags || null));

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
        setSaveError(null);
        try {
            const formData = new FormData();
            formData.set('fullname', fullname);
            formData.set('email', email);
            formData.set('worker_id', workerId);
            formData.set('location_oid', locationOid);
            formData.set('gender', gender);
            formData.set('worker_type', workerType);
            formData.set('job_category', jobCategory);
            formData.set('job_subcategory', jobSubcategory);
            formData.set('job_professional_level', jobProfessionalLevel);
            formData.set('job_management_level', jobManagementLevel);
            formData.set('job_band', jobBand);
            formData.set('job_title', jobTitle);
            formData.set('is_vip', String(isVip));
            formData.set('vip_type', isVip ? vipType : '');
            formData.set('is_active', String(isActive));
            await updateWorkerAction(worker.oid, formData);
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save changes';
            setSaveError(message);
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
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete worker';
            alert(message);
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setSaveError(null);
        setFullname(worker.fullname);
        setEmail(worker.email || '');
        setWorkerId(worker.worker_id || '');
        setLocationOid(worker.location_oid || '');
        setGender(worker.gender || '');
        setWorkerType(worker.worker_type || '');
        setJobCategory(worker.job_category || '');
        setJobSubcategory(worker.job_subcategory || '');
        setJobProfessionalLevel(worker.job_professional_level || '');
        setJobManagementLevel(worker.job_management_level || '');
        setJobBand(worker.job_band || '');
        setJobTitle(worker.job_title || '');
        setIsVip(worker.is_vip);
        setVipType(worker.vip_type || '');
        setIsActive(worker.is_active);
        setIsEditing(false);
    };

    const resetProfileDraft = (nextProfile: WorkerProfile | null) => {
        setProfileSummaryText(nextProfile?.summary || '');
        setProfileTopicsDraft(nextProfile?.topics || []);
        setProfileTagsText(formatCommaList(nextProfile?.tags || null));
    };

    const handleProfileCancel = () => {
        resetProfileDraft(profile);
        setProfileError(null);
        setIsProfileEditing(false);
    };

    const handleProfileSave = async () => {
        setIsProfilePending(true);
        setProfileError(null);

        try {
            const normalizedSummary = normalizeSummary(profileSummaryText);
            const normalizedTopics = profileTopicsDraft.filter(t => t.topic.trim()).map(t => ({
                ...t,
                topic: t.topic.trim(),
                need: t.need.trim(),
                notes: t.notes?.trim() || null,
            }));
            const finalTopics = normalizedTopics.length > 0 ? normalizedTopics : null;
            const normalizedTags = parseCommaList(profileTagsText);

            const payload: WorkerProfileUpsert = {};

            if (normalizedSummary !== (profile?.summary || null)) {
                payload.summary = normalizedSummary;
            }
            if (!areTopicsEqual(finalTopics, profile?.topics || null)) {
                payload.topics = finalTopics;
            }
            if (!areStringArraysEqual(normalizedTags, profile?.tags || null)) {
                payload.tags = normalizedTags;
            }

            if (payload.summary === undefined && payload.topics === undefined && payload.tags === undefined) {
                setIsProfileEditing(false);
                return;
            }

            const updatedProfile = await upsertWorkerProfileAction(worker.oid, payload);
            setProfile(updatedProfile);
            resetProfileDraft(updatedProfile);
            setIsProfileEditing(false);
        } catch (error) {
            setProfileError(error instanceof Error ? error.message : 'Failed to save worker profile');
        } finally {
            setIsProfilePending(false);
        }
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

                        {/* Worker Type */}
                        <div>
                            <label className={labelClass}>Worker Type</label>
                            {isEditing ? (
                                <select
                                    value={workerType}
                                    onChange={(e) => setWorkerType(e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">{t('workers.notSet')}</option>
                                    <option value="Regular">Regular</option>
                                    <option value="Intern">Intern</option>
                                    <option value="Partner">Partner</option>
                                    <option value="Contingent">Contingent</option>
                                    <option value="Consultant">Consultant</option>
                                </select>
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{worker.worker_type || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>

                        {/* VIP Status */}
                        <div>
                            <label className={labelClass}>Is VIP</label>
                            {isEditing ? (
                                <label className="flex items-center gap-2 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={isVip}
                                        onChange={(e) => setIsVip(e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <span className={isLight ? 'text-slate-700' : 'text-gray-300'}>
                                        {isVip ? 'Yes' : 'No'}
                                    </span>
                                </label>
                            ) : (
                                <div className={displayClass}>
                                    {worker.is_vip ? (
                                        <span className="flex items-center gap-1 text-green-500"><Check className="w-4 h-4" /> Yes</span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-slate-500"><X className="w-4 h-4" /> No</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* VIP Type */}
                        <div>
                            <label className={labelClass}>VIP Type</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={vipType}
                                    onChange={(e) => setVipType(e.target.value)}
                                    placeholder="Optional"
                                    className={inputClass}
                                    disabled={!isVip}
                                />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{worker.vip_type || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>

                        {/* Job Category */}
                        <div>
                            <label className={labelClass}>{t('workers.jobCategory')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobCategory} onChange={(e) => setJobCategory(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_category || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>

                        {/* Job Subcategory */}
                        <div>
                            <label className={labelClass}>{t('workers.jobSubcategory')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobSubcategory} onChange={(e) => setJobSubcategory(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_subcategory || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                        {/* Job Professional Level */}
                        <div>
                            <label className={labelClass}>{t('workers.jobProfessionalLevel')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobProfessionalLevel} onChange={(e) => setJobProfessionalLevel(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_professional_level || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>

                        {/* Job Management Level */}
                        <div>
                            <label className={labelClass}>{t('workers.jobManagementLevel')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobManagementLevel} onChange={(e) => setJobManagementLevel(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Users className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_management_level || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>

                        {/* Job Band */}
                        <div>
                            <label className={labelClass}>{t('workers.jobBand')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobBand} onChange={(e) => setJobBand(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_band || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
                                </div>
                            )}
                        </div>

                        {/* Job Title */}
                        <div>
                            <label className={labelClass}>{t('workers.jobTitle')}</label>
                            {isEditing && canEditSensitive ? (
                                <input type="text" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Optional" className={inputClass} />
                            ) : (
                                <div className={displayClass}>
                                    <Briefcase className={iconClass} />
                                    <span className={textClass}>{canReadSensitive ? (worker.job_title || t('workers.notSet')) : t('workers.sensitiveFieldHidden')}</span>
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
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>{t('workers.hireDate')}</label>
                            <div className={displayClass}>
                                <Calendar className={iconClass} />
                                <span className={textClass}>{worker.hire_date ? formatDate(worker.hire_date, timezone) : t('workers.notSet')}</span>
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>{t('common.created')}</label>
                            <div className={displayClass}>
                                <Calendar className={iconClass} />
                                <span className={textClass}>{formatDateTime(worker.created_at, timezone)}</span>
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>{t('common.updated')}</label>
                            <div className={displayClass}>
                                <Calendar className={iconClass} />
                                <span className={textClass}>{formatDateTime(worker.updated_at, timezone)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Save Error */}
                    {saveError && (
                        <div className={`p-3 rounded-lg text-sm ${isLight ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                            {saveError}
                        </div>
                    )}

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

                {/* Worker Profile */}
                <div className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-center justify-between">
                        <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('workers.profile.title')}</h2>
                        {!isProfileEditing && (
                            <button
                                onClick={() => {
                                    setProfileError(null);
                                    resetProfileDraft(profile);
                                    setIsProfileEditing(true);
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                            >
                                <Pencil className="w-4 h-4" />
                                <span>{t('common.edit')}</span>
                            </button>
                        )}
                    </div>

                    {profileError && (
                        <div className={`px-3 py-2 rounded-lg text-sm ${isLight ? 'bg-red-50 text-red-700' : 'bg-red-500/10 text-red-300'}`}>
                            {profileError}
                        </div>
                    )}

                    {isProfileEditing ? (
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>{t('workers.profile.summary')}</label>
                                <textarea
                                    rows={4}
                                    value={profileSummaryText}
                                    onChange={(e) => setProfileSummaryText(e.target.value)}
                                    className={`${inputClass} resize-y`}
                                    placeholder={t('workers.notSet')}
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className={labelClass}>{t('workers.profile.topics')}</label>
                                    <button
                                        type="button"
                                        onClick={() => setProfileTopicsDraft([...profileTopicsDraft, emptyTopicItem()])}
                                        className={`text-xs px-2 py-1 rounded ${isLight ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-white/10 text-gray-400 hover:bg-white/15'}`}
                                    >
                                        + {t('workers.profile.addTopic')}
                                    </button>
                                </div>
                                {profileTopicsDraft.length === 0 ? (
                                    <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{t('workers.notSet')}</p>
                                ) : (
                                    <div className="space-y-3">
                                        {profileTopicsDraft.map((item, idx) => (
                                            <div key={idx} className={`p-3 rounded-lg border space-y-2 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
                                                <div className="flex items-center justify-between gap-2">
                                                    <input
                                                        type="text"
                                                        value={item.topic}
                                                        onChange={(e) => {
                                                            const next = [...profileTopicsDraft];
                                                            next[idx] = { ...next[idx], topic: e.target.value };
                                                            setProfileTopicsDraft(next);
                                                        }}
                                                        className={`${inputClass} flex-1`}
                                                        placeholder={t('workers.profile.topicName')}
                                                    />
                                                    <select
                                                        value={item.status}
                                                        onChange={(e) => {
                                                            const next = [...profileTopicsDraft];
                                                            next[idx] = { ...next[idx], status: e.target.value as 'resolved' | 'unresolved' };
                                                            setProfileTopicsDraft(next);
                                                        }}
                                                        className={`${inputClass} w-36`}
                                                    >
                                                        <option value="unresolved">{t('workers.profile.topicUnresolved')}</option>
                                                        <option value="resolved">{t('workers.profile.topicResolved')}</option>
                                                    </select>
                                                    <button
                                                        type="button"
                                                        onClick={() => setProfileTopicsDraft(profileTopicsDraft.filter((_, i) => i !== idx))}
                                                        className="p-1 rounded hover:bg-red-500/10 text-red-400"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={item.need}
                                                    onChange={(e) => {
                                                        const next = [...profileTopicsDraft];
                                                        next[idx] = { ...next[idx], need: e.target.value };
                                                        setProfileTopicsDraft(next);
                                                    }}
                                                    className={inputClass}
                                                    placeholder={t('workers.profile.topicNeed')}
                                                />
                                                <input
                                                    type="text"
                                                    value={item.notes || ''}
                                                    onChange={(e) => {
                                                        const next = [...profileTopicsDraft];
                                                        next[idx] = { ...next[idx], notes: e.target.value || null };
                                                        setProfileTopicsDraft(next);
                                                    }}
                                                    className={inputClass}
                                                    placeholder={t('workers.profile.topicNotes')}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className={labelClass}>{t('workers.profile.tags')}</label>
                                <input
                                    type="text"
                                    value={profileTagsText}
                                    onChange={(e) => setProfileTagsText(e.target.value)}
                                    className={inputClass}
                                    placeholder={t('workers.profile.commaDelimited')}
                                />
                                <p className={`mt-1 text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('workers.profile.commaDelimited')}</p>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={handleProfileSave}
                                    disabled={isProfilePending}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
                                >
                                    {isProfilePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span>{t('common.save')}</span>
                                </button>
                                <button
                                    onClick={handleProfileCancel}
                                    disabled={isProfilePending}
                                    className={`px-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}
                                >
                                    {t('common.cancel')}
                                </button>
                            </div>
                        </div>
                    ) : profile ? (
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>{t('workers.profile.summary')}</label>
                                <div className={`px-3 py-2 rounded-lg whitespace-pre-wrap ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                    {profile.summary || t('workers.notSet')}
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>{t('workers.profile.topics')}</label>
                                {profile.topics && profile.topics.length > 0 ? (
                                    <div className="space-y-2">
                                        {profile.topics.map((item, i) => (
                                            <div
                                                key={`${item.topic}-${i}`}
                                                className={`p-3 rounded-lg border ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-white/5'}`}
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{item.topic}</span>
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${item.status === 'resolved'
                                                        ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                                    }`}>
                                                        {item.status === 'resolved' ? t('workers.profile.topicResolved') : t('workers.profile.topicUnresolved')}
                                                    </span>
                                                </div>
                                                <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>{item.need}</p>
                                                {item.notes && (
                                                    <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{item.notes}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={displayClass}>
                                        <span className={textClass}>{t('workers.notSet')}</span>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className={labelClass}>{t('workers.profile.tags')}</label>
                                {profile.tags && profile.tags.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {profile.tags.map((tag, i) => (
                                            <span
                                                key={`${tag}-${i}`}
                                                className={`px-2 py-1 rounded-lg text-sm ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <div className={displayClass}>
                                        <span className={textClass}>{t('workers.notSet')}</span>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>{t('workers.profile.summaryUpdated')}</label>
                                    <div className={displayClass}>
                                        <Calendar className={iconClass} />
                                        <span className={textClass}>
                                            {profile.summary_updated_at ? formatDateTime(profile.summary_updated_at, timezone) : t('workers.notSet')}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>{t('workers.profile.topicsUpdated')}</label>
                                    <div className={displayClass}>
                                        <Calendar className={iconClass} />
                                        <span className={textClass}>
                                            {profile.topics_updated_at ? formatDateTime(profile.topics_updated_at, timezone) : t('workers.notSet')}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>{t('workers.profile.tagsUpdated')}</label>
                                    <div className={displayClass}>
                                        <Calendar className={iconClass} />
                                        <span className={textClass}>
                                            {profile.tags_updated_at ? formatDateTime(profile.tags_updated_at, timezone) : t('workers.notSet')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
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
