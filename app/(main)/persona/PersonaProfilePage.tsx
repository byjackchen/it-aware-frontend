'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarClock, Network, ShieldCheck, User, Users, BriefcaseBusiness } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDate, formatDateTime } from '@/lib/utils/datetime';
import { ObjectGraph } from '@/components/data';
import type { GlobalEdge, Location, Organization, Worker, WorkerProfile, WorkerCluster, ClusterSummaryResponse } from '@/lib/types/objects';
import { PersonaOrgWorkerSidebar } from './PersonaOrgWorkerSidebar';
import { PersonaActivitiesTimeline } from './PersonaActivitiesTimeline';
import { ClusterProfileCard } from './ClusterProfileCard';

interface PersonaProfilePageProps {
    currentWorker: Worker;
    workerProfile: WorkerProfile | null;
    organization: Organization | null;
    location: Location | null;
    edges: GlobalEdge[];
    workerCluster: WorkerCluster | null;
    clusterSummary: ClusterSummaryResponse | null;
}

function formatTagsList(items: string[] | null): string {
    if (!items || items.length === 0) return '—';
    return items.join(', ');
}

export function PersonaProfilePage({
    currentWorker,
    workerProfile,
    organization,
    location,
    edges,
    workerCluster,
    clusterSummary,
}: PersonaProfilePageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const t = useTranslations('Persona');
    const tData = useTranslations('Data');
    const isLight = theme === 'light';
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    const filteredEdges = useMemo(() => {
        if (!edgeFilter) return edges;
        return edges.filter((edge) => {
            const connectedObject = edge.from_oid === currentWorker.oid ? edge.to_object : edge.from_object;
            return connectedObject?.object_type === edgeFilter;
        });
    }, [currentWorker.oid, edgeFilter, edges]);

    const cardClass = `rounded-xl border p-5 ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-900'}`;
    const sectionTitleClass = `text-base font-semibold ${isLight ? 'text-slate-800' : 'text-slate-100'}`;
    const labelClass = `text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`;
    const valueClass = `text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-200'}`;

    const statusText = currentWorker.is_active ? t('status.active') : t('status.inactive');
    const vipText = currentWorker.is_vip ? t('status.vip') : t('status.notVip');

    return (
        <div className="h-[calc(100vh-4rem)]" suppressHydrationWarning>
            <div className="h-full flex">
                <aside className="w-[340px] h-full overflow-hidden">
                    <PersonaOrgWorkerSidebar currentWorker={currentWorker} />
                </aside>

                <main className={`flex-1 h-full overflow-y-auto ${isLight ? 'bg-slate-50' : 'bg-slate-950'}`} suppressHydrationWarning>
                    <div className="w-full px-6 py-6 space-y-6">
                        <section className={cardClass}>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-300'}`}>
                                    {currentWorker.fullname.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <h1 className={`text-2xl font-bold truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>{currentWorker.fullname}</h1>
                                    <p className={`text-sm truncate ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                                        {currentWorker.job_title || currentWorker.job_band || t('status.notSet')}
                                    </p>
                                    <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                        {currentWorker.stable_id}
                                    </p>
                                    {workerCluster && (
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                workerCluster.cluster_label === -1
                                                    ? (isLight ? 'bg-slate-100 text-slate-500 border border-slate-200' : 'bg-slate-700 text-slate-400 border border-slate-600')
                                                    : (isLight ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30')
                                            }`}>
                                                <Network className="w-3 h-3 mr-1" />
                                                {workerCluster.cluster_label === -1
                                                    ? t('cluster.noise')
                                                    : (workerCluster.cluster_name || `Cluster ${workerCluster.cluster_label}`)}
                                            </span>
                                            {workerCluster.cluster_label !== -1 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                                    workerCluster.cluster_probability >= 0.8
                                                        ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                                        : workerCluster.cluster_probability >= 0.5
                                                            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                }`}>
                                                    {t('cluster.probability')}: {(workerCluster.cluster_probability * 100).toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        {/* Personal Info + Job Info row */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                            <section className={cardClass}>
                                <div className="flex items-center gap-2 mb-4">
                                    <User className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-300'}`} />
                                    <h2 className={sectionTitleClass}>{t('sections.personalInfo')}</h2>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className={labelClass}>{tData('workers.fullName')}</div>
                                        <div className={valueClass}>{currentWorker.fullname}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.stableId')}</div>
                                        <div className={valueClass}>{currentWorker.stable_id}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.workerId')}</div>
                                        <div className={valueClass}>{currentWorker.worker_id || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.email')}</div>
                                        <div className={valueClass}>{currentWorker.email || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.gender')}</div>
                                        <div className={valueClass}>{currentWorker.gender || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{t('fields.workerType')}</div>
                                        <div className={valueClass}>{currentWorker.worker_type || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{t('fields.vipStatus')}</div>
                                        <div className={valueClass}>{vipText}{currentWorker.vip_type ? ` · ${currentWorker.vip_type}` : ''}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.hireDate')}</div>
                                        <div className={valueClass}>{currentWorker.hire_date ? formatDate(currentWorker.hire_date, timezone) : t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.status')}</div>
                                        <div className={valueClass}>{statusText}</div>
                                    </div>
                                </div>
                            </section>

                            <section className={cardClass}>
                                <div className="flex items-center gap-2 mb-4">
                                    <BriefcaseBusiness className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-300'}`} />
                                    <h2 className={sectionTitleClass}>{t('sections.jobInfo')}</h2>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className={labelClass}>{tData('workers.organization')}</div>
                                        <div className={valueClass}>{organization?.name || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.location')}</div>
                                        <div className={valueClass}>{location?.name || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.jobCategory')}</div>
                                        <div className={valueClass}>{currentWorker.job_category || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.jobSubcategory')}</div>
                                        <div className={valueClass}>{currentWorker.job_subcategory || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.jobProfessionalLevel')}</div>
                                        <div className={valueClass}>{currentWorker.job_professional_level || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.jobManagementLevel')}</div>
                                        <div className={valueClass}>{currentWorker.job_management_level || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.jobBand')}</div>
                                        <div className={valueClass}>{currentWorker.job_band || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('workers.jobTitle')}</div>
                                        <div className={valueClass}>{currentWorker.job_title || t('status.notSet')}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('common.created')}</div>
                                        <div className={valueClass}>{formatDateTime(currentWorker.created_at, timezone)}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{tData('common.updated')}</div>
                                        <div className={valueClass}>{formatDateTime(currentWorker.updated_at, timezone)}</div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Profile Info - full width */}
                        <section className={cardClass}>
                            <div className="flex items-center gap-2 mb-4">
                                <ShieldCheck className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-300'}`} />
                                <h2 className={sectionTitleClass}>{t('sections.profileInfo')}</h2>
                            </div>
                            {!workerProfile ? (
                                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{t('profile.empty')}</p>
                            ) : (
                                <div className="space-y-5">
                                    {/* Summary */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className={labelClass}>{t('profile.summary')}</div>
                                            {workerProfile.summary_updated_at && (
                                                <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                    {formatDateTime(workerProfile.summary_updated_at, timezone)}
                                                </span>
                                            )}
                                        </div>
                                        <div className={`${valueClass} whitespace-pre-wrap`}>{workerProfile.summary || t('status.notSet')}</div>
                                    </div>

                                    {/* Topics */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className={labelClass}>{t('profile.topics')}</div>
                                            {workerProfile.topics_updated_at && (
                                                <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                    {formatDateTime(workerProfile.topics_updated_at, timezone)}
                                                </span>
                                            )}
                                        </div>
                                        {workerProfile.topics && workerProfile.topics.length > 0 ? (
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {workerProfile.topics.map((item, i) => (
                                                    <div
                                                        key={`${item.topic}-${i}`}
                                                        className={`p-2.5 rounded-lg border min-w-[200px] max-w-[320px] ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-white/5'}`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{item.topic}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${item.status === 'resolved'
                                                                ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                                                : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                                            }`}>
                                                                {item.status}
                                                            </span>
                                                        </div>
                                                        <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>{item.need}</p>
                                                        {item.notes && (
                                                            <p className={`text-[11px] mt-0.5 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{item.notes}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className={valueClass}>{t('status.notSet')}</div>
                                        )}
                                    </div>

                                    {/* Tags */}
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className={labelClass}>{t('profile.tags')}</div>
                                            {workerProfile.tags_updated_at && (
                                                <span className={`text-[11px] ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                    {formatDateTime(workerProfile.tags_updated_at, timezone)}
                                                </span>
                                            )}
                                        </div>
                                        {workerProfile.tags && workerProfile.tags.length > 0 ? (
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {workerProfile.tags.map((tag, i) => (
                                                    <span
                                                        key={`${tag}-${i}`}
                                                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${isLight ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'}`}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className={valueClass}>{t('status.notSet')}</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>

                        <ClusterProfileCard
                            currentWorker={currentWorker}
                            workerCluster={workerCluster}
                            clusterSummary={clusterSummary}
                            isLight={isLight}
                            cardClass={cardClass}
                            sectionTitleClass={sectionTitleClass}
                            labelClass={labelClass}
                            valueClass={valueClass}
                        />

                        <section className={cardClass}>
                            <div className="flex items-center gap-2 mb-4">
                                <CalendarClock className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-300'}`} />
                                <h2 className={sectionTitleClass}>{t('sections.activitiesTimeline')}</h2>
                            </div>
                            <PersonaActivitiesTimeline worker={currentWorker} />
                        </section>

                        <section className={cardClass}>
                            <div className="flex items-center gap-2 mb-4">
                                <Users className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-300'}`} />
                                <h2 className={sectionTitleClass}>{t('sections.graphLinks')}</h2>
                            </div>
                            <ObjectGraph
                                oid={currentWorker.oid}
                                objectType="worker"
                                descriptor={currentWorker.fullname}
                                edges={filteredEdges}
                                allEdges={edges}
                                onFilterChange={setEdgeFilter}
                                selectedFilter={edgeFilter}
                            />
                        </section>
                    </div>
                </main>
            </div>
        </div>
    );
}
