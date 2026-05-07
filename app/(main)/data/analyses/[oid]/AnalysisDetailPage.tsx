'use client';

/**
 * Analysis detail page client component.
 */

import { useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
    ArrowLeft,
    Sparkles,
    User,
    Building2,
    FileSearch,
    Pencil,
    Save,
    Trash2,
    Loader2,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { ObjectGraph } from '@/components/data';
import { formatDateTime } from '@/lib/utils/datetime';
import type { Analysis, GlobalEdge, Worker, ServiceCatalog } from '@/lib/types/objects';
import { updateAnalysisAction, deleteAnalysisAction } from '@/app/actions/objects';

interface AnalysisDetailPageProps {
    analysis: Analysis;
    edges: GlobalEdge[];
    workers: Worker[];
    serviceCatalogs: ServiceCatalog[];
    sourceUrl: string | null;
    batchMap: Record<string, string>;
}

const SEMANTIC_OPTIONS = ['', 'positive', 'negative'];
const INTENT_OPTIONS = ['', 'request', 'bug', 'complaint', 'praise', 'suggestion'];

const SEMANTIC_COLORS: Record<string, { bg: string; text: string }> = {
    positive: { bg: 'bg-green-500/20', text: 'text-green-500' },
    negative: { bg: 'bg-red-500/20', text: 'text-red-500' },
};

const INTENT_COLORS: Record<string, { bg: string; text: string }> = {
    request: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
    bug: { bg: 'bg-red-500/20', text: 'text-red-500' },
    complaint: { bg: 'bg-orange-500/20', text: 'text-orange-500' },
    praise: { bg: 'bg-green-500/20', text: 'text-green-500' },
    suggestion: { bg: 'bg-purple-500/20', text: 'text-purple-500' },
};

export function AnalysisDetailPage({ analysis, edges, workers, serviceCatalogs, sourceUrl, batchMap }: AnalysisDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useTransitionRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    // Form State
    const [keywords, setKeywords] = useState(analysis.keywords?.join(', ') || '');
    const [fact, setFact] = useState(analysis.fact || '');
    const [semantic, setSemantic] = useState(analysis.semantic || '');
    const [intent, setIntent] = useState(analysis.intent || '');
    const [serviceCatalogOid, setServiceCatalogOid] = useState(analysis.service_catalog_oid || '');
    const [configurationItemOid, setConfigurationItemOid] = useState(analysis.configuration_item_oid || '');

    const worker = workers.find((w) => w.oid === analysis.worker_oid);
    const semStyle = analysis.semantic ? SEMANTIC_COLORS[analysis.semantic] : null;

    const filteredEdges = edgeFilter ? edges.filter((e) => {
        const connectedObject = e.from_oid === analysis.oid ? e.to_object : e.from_object;
        return connectedObject?.object_type === edgeFilter;
    }) : edges;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('keywords', keywords.trim() ? JSON.stringify(keywords.split(',').map(k => k.trim()).filter(Boolean)) : '');
            formData.set('fact', fact);
            formData.set('semantic', semantic);
            formData.set('intent', intent);
            formData.set('service_catalog_oid', serviceCatalogOid);
            formData.set('configuration_item_oid', configurationItemOid);

            await updateAnalysisAction(analysis.oid, formData);
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error('Failed to update analysis:', error);
            alert(error instanceof Error ? error.message : 'Failed to update analysis');
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this analysis?')) return;
        setIsPending(true);
        try {
            await deleteAnalysisAction(analysis.oid);
            router.push('/data/analyses');
        } catch (error) {
            console.error('Failed to delete analysis:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete analysis');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setKeywords(analysis.keywords?.join(', ') || '');
        setFact(analysis.fact || '');
        setSemantic(analysis.semantic || '');
        setIntent(analysis.intent || '');
        setServiceCatalogOid(analysis.service_catalog_oid || '');
        setConfigurationItemOid(analysis.configuration_item_oid || '');
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/analyses')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{analysis.topic}</h1>
                                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {analysis.source_type}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors">
                                <Pencil className="w-4 h-4" />
                                <span>{t('common.edit')}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Worker */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('analyses.worker')}</label>
                        <div className={`flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                            <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                            {worker ? (
                                <Link href={`/data/workers/${worker.stable_id}`} className="underline underline-offset-4">
                                    {worker.fullname} ({worker.stable_id})
                                </Link>
                            ) : (
                                <span className="font-mono text-xs">{analysis.worker_oid}</span>
                            )}
                        </div>
                    </div>

                    {/* Source Object */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('analyses.sourceObject')}</label>
                        <div className={`flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                            <FileSearch className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                            {sourceUrl ? (
                                <Link href={sourceUrl} className="underline underline-offset-4 capitalize">
                                    {analysis.source_type}
                                </Link>
                            ) : (
                                <span className="capitalize">{analysis.source_type} <span className="font-mono text-xs opacity-50">({analysis.source_oid})</span></span>
                            )}
                        </div>
                    </div>

                    {/* Source Batch */}
                    {analysis.source_batch_oid && (
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('analyses.sourceBatch')}</label>
                            <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                {batchMap[analysis.source_batch_oid] || <span className="font-mono text-xs">{analysis.source_batch_oid}</span>}
                            </div>
                        </div>
                    )}

                    {/* Keywords, Semantic & Intent */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('analyses.keywords')}</label>
                        {isEditing ? (
                            <div className="space-y-3">
                                <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                    placeholder="keyword1, keyword2, ..." />
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{t('analyses.semantic')}</label>
                                        <select value={semantic} onChange={(e) => setSemantic(e.target.value)}
                                            className={`w-full px-3 py-2 rounded-lg capitalize ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}>
                                            {SEMANTIC_OPTIONS.map(opt => (<option key={opt} value={opt}>{opt || '\u2014'}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{t('analyses.intent')}</label>
                                        <select value={intent} onChange={(e) => setIntent(e.target.value)}
                                            className={`w-full px-3 py-2 rounded-lg capitalize ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}>
                                            {INTENT_OPTIONS.map(opt => (<option key={opt} value={opt}>{opt || '\u2014'}</option>))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {analysis.semantic && (
                                    <span className={`text-xs px-2.5 py-1 rounded-full capitalize font-medium ${SEMANTIC_COLORS[analysis.semantic]?.bg ?? ''} ${SEMANTIC_COLORS[analysis.semantic]?.text ?? ''}`}>
                                        {t('analyses.semantic')}: {analysis.semantic}
                                    </span>
                                )}
                                {analysis.intent && (
                                    <span className={`text-xs px-2.5 py-1 rounded-full capitalize font-medium ${INTENT_COLORS[analysis.intent]?.bg ?? ''} ${INTENT_COLORS[analysis.intent]?.text ?? ''}`}>
                                        {t('analyses.intent')}: {analysis.intent}
                                    </span>
                                )}
                                {analysis.keywords?.length ? analysis.keywords.map((kw, i) => (
                                    <span key={i} className={`text-xs px-2.5 py-1 rounded-full ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>
                                        {kw}
                                    </span>
                                )) : (
                                    !analysis.semantic && !analysis.intent && (
                                        <span className={`italic text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{t('analyses.noKeywords')}</span>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* Fact */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('analyses.fact')}</label>
                        {isEditing ? (
                            <input type="text" value={fact} onChange={(e) => setFact(e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                placeholder="Concise factual summary..." />
                        ) : (
                            <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                {analysis.fact || <span className="italic opacity-50">{'\u2014'}</span>}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        {/* Service Catalog */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('analyses.serviceCatalog')}</label>
                            {isEditing ? (
                                <select value={serviceCatalogOid} onChange={(e) => setServiceCatalogOid(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}>
                                    <option value="">None</option>
                                    {serviceCatalogs.map(sc => (<option key={sc.oid} value={sc.oid}>{sc.name}</option>))}
                                </select>
                            ) : (
                                <div className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <Building2 className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                        {serviceCatalogs.find(sc => sc.oid === analysis.service_catalog_oid)?.name || 'None'}
                                    </span>
                                </div>
                            )}
                        </div>
                        {/* Configuration Item */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                {isEditing ? t('analyses.configurationItem') + ' OID' : t('analyses.configurationItem')}
                            </label>
                            {isEditing ? (
                                <input type="text" value={configurationItemOid} onChange={(e) => setConfigurationItemOid(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                    placeholder="Optional configuration item OID" />
                            ) : (
                                <div className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <Building2 className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                        {serviceCatalogs.find(sc => sc.oid === analysis.configuration_item_oid)?.name || analysis.configuration_item_oid || 'None'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Effective At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(analysis.effective_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Created At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(analysis.created_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Updated At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(analysis.updated_at, timezone)}</span>
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
                                <span>{t('common.delete')} Analysis</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('common.edgeRelationships')}</h2>
                    <ObjectGraph
                        oid={analysis.oid}
                        objectType="analysis"
                        descriptor={analysis.topic}
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
