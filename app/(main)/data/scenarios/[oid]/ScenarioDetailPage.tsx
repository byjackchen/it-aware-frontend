'use client';

/**
 * Scenario detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
    ArrowLeft,
    Route,
    Pencil,
    Save,
    Trash2,
    Loader2,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { ObjectGraph } from '@/components/data';
import { formatDateTime } from '@/lib/utils/datetime';
import type { Scenario, GlobalEdge, Worker } from '@/lib/types/objects';
import { updateScenarioAction, deleteScenarioAction } from '@/app/actions/objects';

interface ScenarioDetailPageProps {
    scenario: Scenario;
    edges: GlobalEdge[];
    workers: Worker[];
}

export function ScenarioDetailPage({ scenario, edges, workers }: ScenarioDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    // Form State
    const [scenarioType, setScenarioType] = useState<string>(scenario.scenario_type);
    const [description, setDescription] = useState(scenario.scenario_profile?.description || '');
    const [notes, setNotes] = useState(scenario.scenario_profile?.notes || '');
    const [keyTopics, setKeyTopics] = useState(
        scenario.scenario_profile?.key_topics?.join(', ') || ''
    );

    const scenarioWorker = workers.find((w) => w.oid === scenario.worker_oid);
    const workerName = scenarioWorker?.fullname || scenario.worker_oid;

    const filteredEdges = edgeFilter ? edges.filter((e) => {
        const connectedObject = e.from_oid === scenario.oid ? e.to_object : e.from_object;
        return connectedObject?.object_type === edgeFilter;
    }) : edges;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const profile = {
                description: description.trim() || null,
                notes: notes.trim() || null,
                key_topics: keyTopics.trim()
                    ? keyTopics.split(',').map(t => t.trim()).filter(Boolean)
                    : null,
            };

            const formData = new FormData();
            formData.set('scenario_type', scenarioType);
            formData.set('scenario_profile', JSON.stringify(profile));

            await updateScenarioAction(scenario.oid, formData);
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error('Failed to update scenario:', error);
            alert(error instanceof Error ? error.message : 'Failed to update scenario');
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('scenarios.deleteConfirm'))) return;
        setIsPending(true);
        try {
            await deleteScenarioAction(scenario.oid);
            router.push('/data/scenarios');
        } catch (error) {
            console.error('Failed to delete scenario:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete scenario');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setScenarioType(scenario.scenario_type);
        setDescription(scenario.scenario_profile?.description || '');
        setNotes(scenario.scenario_profile?.notes || '');
        setKeyTopics(scenario.scenario_profile?.key_topics?.join(', ') || '');
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/scenarios')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-cyan-100 text-cyan-600' : 'bg-cyan-500/20 text-cyan-400'}`}>
                                <Route className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('scenarios.detail')}</h1>
                                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {scenario.scenario_type}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors">
                                <Pencil className="w-4 h-4" />
                                <span>Edit</span>
                            </button>
                        )}
                        {!isEditing && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${isLight ? 'bg-cyan-100 text-cyan-700' : 'bg-cyan-500/20 text-cyan-300'}`}>
                                {scenario.scenario_type}
                            </div>
                        )}
                    </div>
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Scenario Type */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('scenarios.scenarioType')}</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={scenarioType}
                                    onChange={(e) => setScenarioType(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                />
                            ) : (
                                <div className={`text-sm capitalize ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{scenario.scenario_type}</div>
                            )}
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('scenarios.worker')}</label>
                            <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                <Link href={`/data/workers/${scenarioWorker?.stable_id || scenario.worker_oid}`} className="underline underline-offset-4">
                                    {workerName}
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('scenarios.description')}</label>
                        {isEditing ? (
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                placeholder="Scenario description..."
                            />
                        ) : (
                            <div className={`p-4 rounded-lg whitespace-pre-wrap ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                {scenario.scenario_profile?.description || <span className="italic opacity-50">{t('scenarios.noDescription')}</span>}
                            </div>
                        )}
                    </div>

                    {/* Notes */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('scenarios.notes')}</label>
                        {isEditing ? (
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                placeholder="Notes..."
                            />
                        ) : (
                            <div className={`p-4 rounded-lg whitespace-pre-wrap ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                {scenario.scenario_profile?.notes || <span className="italic opacity-50">{t('scenarios.noNotes')}</span>}
                            </div>
                        )}
                    </div>

                    {/* Key Topics */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('scenarios.keyTopics')}</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={keyTopics}
                                onChange={(e) => setKeyTopics(e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                placeholder="Comma-separated topics..."
                            />
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {scenario.scenario_profile?.key_topics?.length ? (
                                    scenario.scenario_profile.key_topics.map((topic, idx) => (
                                        <span key={idx} className={`text-xs px-2.5 py-1 rounded-full ${isLight ? 'bg-cyan-100 text-cyan-700' : 'bg-cyan-500/20 text-cyan-300'}`}>
                                            {topic}
                                        </span>
                                    ))
                                ) : (
                                    <span className={`italic opacity-50 text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('scenarios.noKeyTopics')}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">{t('scenarios.effectiveAt')}</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(scenario.effective_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">{t('common.created')}</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(scenario.created_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">{t('common.updated')}</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(scenario.updated_at, timezone)}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    {isEditing ? (
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>Save</span>
                            </button>
                            <button onClick={handleCancel} disabled={isPending} className={`px-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>Cancel</button>
                        </div>
                    ) : (
                        <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                            <button onClick={handleDelete} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span>Delete Scenario</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('common.edgeRelationships')}</h2>
                    <ObjectGraph
                        oid={scenario.oid}
                        objectType="scenario"
                        descriptor={scenario.scenario_type}
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
