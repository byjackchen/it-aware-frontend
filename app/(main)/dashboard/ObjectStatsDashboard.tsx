'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
    AlertCircle,
    Bell,
    Brain,
    Building2,
    ClipboardList,
    FileText,
    Layers,
    Loader2,
    MapPin,
    MessageCircle,
    MousePointerClick,
    RefreshCw,
    Send,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import type {
    DashboardResourceGroup,
    DashboardResourceKey,
    DashboardResourceStats,
} from '@/lib/types/dashboard';

const GROUP_ORDER: DashboardResourceGroup[] = ['hierarchies', 'objects', 'activities', 'campaigns', 'insights'];

const RESOURCE_ICONS: Record<DashboardResourceKey, LucideIcon> = {
    organizations: Building2,
    locations: MapPin,
    'service-catalogs': Layers,
    workers: Users,
    articles: FileText,
    incidents: AlertCircle,
    requests: ClipboardList,
    inquiries: MessageCircle,
    interactions: MousePointerClick,
    surveys: Send,
    notifications: Bell,
    analyses: Brain,
};

function formatCount(value: number | null): string {
    if (value === null) return '--';
    return value.toLocaleString();
}

export function ObjectStatsDashboard() {
    const { theme } = useTheme();
    const t = useTranslations('Dashboard');
    const { data, error, isLoading, refresh } = useDashboardStats();
    const isLight = theme === 'light';

    const groupedResources = useMemo(() => {
        const groupMap = new Map<DashboardResourceGroup, DashboardResourceStats[]>(
            GROUP_ORDER.map((group) => [group, []])
        );

        for (const resource of data?.resources ?? []) {
            const list = groupMap.get(resource.group);
            if (!list) continue;
            list.push(resource);
        }

        return groupMap;
    }, [data?.resources]);

    const generatedAtLabel = (() => {
        if (!data?.generated_at) return null;
        const date = new Date(data.generated_at);
        if (Number.isNaN(date.getTime())) return null;
        return t('generatedAt', { time: date.toLocaleString() });
    })();

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            {t('title')}
                        </h1>
                        <p className={`text-sm mt-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            {t('subtitle')}
                        </p>
                        {generatedAtLabel && (
                            <p className={`text-xs mt-2 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {generatedAtLabel}
                            </p>
                        )}
                    </div>

                    <button
                        onClick={() => void refresh()}
                        disabled={isLoading}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isLoading
                                ? 'opacity-60 cursor-not-allowed'
                                : ''
                            } ${isLight
                                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                            }`}
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span className="text-sm">{t('refresh')}</span>
                    </button>
                </div>

                {isLoading && !data && (
                    <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-slate-200 bg-white text-slate-500' : 'border-white/10 bg-white/5 text-gray-400'}`}>
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('loading')}
                        </span>
                    </div>
                )}

                {!isLoading && error && !data && (
                    <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                        <p className="text-sm">{t('loadFailed')}</p>
                    </div>
                )}

                {data && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                                <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {t('summary.totalAcrossResources')}
                                </p>
                                <p className={`text-2xl font-semibold mt-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                    {data.summary.total_across_resources.toLocaleString()}
                                </p>
                            </div>
                            <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                                <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {t('summary.activeCapable')}
                                </p>
                                <p className={`text-2xl font-semibold mt-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                    {data.summary.active_capable_active.toLocaleString()} / {data.summary.active_capable_total.toLocaleString()}
                                </p>
                            </div>
                            <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                                <p className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {t('summary.availableResources')}
                                </p>
                                <p className={`text-2xl font-semibold mt-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                    {data.summary.available_resources.toLocaleString()} / {data.resources.length.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {GROUP_ORDER.map((group) => {
                            const resources = groupedResources.get(group) ?? [];
                            if (resources.length === 0) return null;

                            return (
                                <section key={group} className="space-y-3">
                                    <h2 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                        {t(`groups.${group}`)}
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {resources.map((resource) => {
                                            const Icon = RESOURCE_ICONS[resource.key];
                                            const statusLabel = t(`status.${resource.status}`);
                                            const statusClass = resource.status === 'ok'
                                                ? (isLight ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30')
                                                : resource.status === 'forbidden'
                                                    ? (isLight ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-amber-300 bg-amber-500/10 border-amber-500/30')
                                                    : (isLight ? 'text-red-700 bg-red-50 border-red-200' : 'text-red-300 bg-red-500/10 border-red-500/30');

                                            const hasActiveInactiveMetrics =
                                                resource.active !== null && resource.inactive !== null;

                                            const card = (
                                                <div className={`rounded-xl border p-4 transition-colors ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'} ${resource.status === 'ok' ? (isLight ? 'hover:bg-slate-50' : 'hover:bg-white/10') : ''}`}>
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>
                                                                <Icon className="w-4 h-4" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                                    {t(`resources.${resource.key}`)}
                                                                </p>
                                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                                    {t('metrics.total')}: {formatCount(resource.total)}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <span className={`px-2 py-0.5 rounded-md text-[11px] border ${statusClass}`}>
                                                            {statusLabel}
                                                        </span>
                                                    </div>

                                                    {hasActiveInactiveMetrics && (
                                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                                            <div className={`rounded-md px-2 py-1.5 ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                                                                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('metrics.active')}</p>
                                                                <p className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                                    {formatCount(resource.active)}
                                                                </p>
                                                            </div>
                                                            <div className={`rounded-md px-2 py-1.5 ${isLight ? 'bg-slate-100' : 'bg-white/5'}`}>
                                                                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('metrics.inactive')}</p>
                                                                <p className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                                    {formatCount(resource.inactive)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );

                                            if (resource.status !== 'ok') {
                                                return <div key={resource.key}>{card}</div>;
                                            }

                                            return (
                                                <Link key={resource.key} href={resource.href} className="block">
                                                    {card}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </section>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
}
