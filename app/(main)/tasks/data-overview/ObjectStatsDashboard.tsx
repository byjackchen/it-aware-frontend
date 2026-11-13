'use client';

/**
 * Data Overview: the page's heading, and the record counts of the main objects
 * as a compact row of tiles (GET /api/dashboard/object-stats). A tile links to
 * the object's page when its count could be read.
 */

import Link from 'next/link';
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
    MousePointerClick,
    RefreshCw,
    Send,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDashboardStats } from '@/lib/hooks/useDashboardStats';
import type { DashboardResourceKey, DashboardResourceStats } from '@/lib/types/dashboard';

const RESOURCE_ICONS: Record<DashboardResourceKey, LucideIcon> = {
    organizations: Building2,
    locations: MapPin,
    'service-catalogs': Layers,
    workers: Users,
    articles: FileText,
    incidents: AlertCircle,
    requests: ClipboardList,
    interactions: MousePointerClick,
    surveys: Send,
    notifications: Bell,
    analyses: Brain,
};

const STATUS_CLASS: Record<Exclude<DashboardResourceStats['status'], 'ok'>, string> = {
    forbidden: 'bg-warn/10 text-warn',
    error: 'bg-bad/10 text-bad',
};

function formatCount(value: number | null): string {
    if (value === null) return '--';
    return value.toLocaleString();
}

function Tile({ resource }: { resource: DashboardResourceStats }) {
    const t = useTranslations('Dashboard');
    const Icon = RESOURCE_ICONS[resource.key];
    const ok = resource.status === 'ok';
    const tile = (
        <div className={`glass-card h-full rounded-xl px-3 py-2.5 ${ok ? 'transition-colors hover:bg-hover' : ''}`}>
            <p className="flex items-center gap-1.5 text-xs text-ink-2">
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t(`resources.${resource.key}`)}</span>
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">{formatCount(resource.total)}</p>
            {resource.status !== 'ok' && (
                <span className={`inline-block rounded px-1.5 py-px text-[11px] ${STATUS_CLASS[resource.status]}`}>
                    {t(`status.${resource.status}`)}
                </span>
            )}
            {resource.active !== null && resource.inactive !== null && (
                <p className="text-[11px] text-muted">
                    {t('metrics.active')} {formatCount(resource.active)} · {t('metrics.inactive')} {formatCount(resource.inactive)}
                </p>
            )}
        </div>
    );
    return (
        <li data-testid={`object-tile-${resource.key}`}>
            {ok ? <Link href={resource.href} className="block h-full">{tile}</Link> : tile}
        </li>
    );
}

export function ObjectStatsDashboard() {
    const t = useTranslations('Dashboard');
    const { data, error, isLoading, refresh } = useDashboardStats();

    const generatedAtLabel = (() => {
        if (!data?.generated_at) return null;
        const date = new Date(data.generated_at);
        if (Number.isNaN(date.getTime())) return null;
        return t('generatedAt', { time: date.toLocaleString() });
    })();

    return (
        <section className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold text-ink">{t('title')}</h1>
                    <p className="mt-1 text-sm text-ink-2">{t('layers.title')}</p>
                </div>
                <div className="flex items-center gap-3">
                    {generatedAtLabel && <span className="text-xs text-muted">{generatedAtLabel}</span>}
                    <button
                        onClick={() => void refresh()}
                        disabled={isLoading}
                        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-ink-2 transition-colors hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span className="text-sm">{t('refresh')}</span>
                    </button>
                </div>
            </div>

            {isLoading && !data && (
                <div className="glass-card rounded-xl p-4 text-center text-sm text-muted">
                    <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('loading')}
                    </span>
                </div>
            )}

            {!isLoading && error && !data && (
                <div role="alert" className="rounded-xl border border-bad/30 bg-bad/10 p-4 text-center text-sm text-bad">
                    {t('loadFailed')}
                </div>
            )}

            {data && (
                <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" data-testid="object-tiles">
                    {data.resources.map((resource) => (
                        <Tile key={resource.key} resource={resource} />
                    ))}
                </ul>
            )}
        </section>
    );
}
