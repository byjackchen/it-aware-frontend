'use client';

/**
 * Article detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    FileText,
    Trash2,
    Pencil,
    Save,
    Loader2,
    Calendar,
    Layers,
    CheckCircle,
    XCircle,
    History,
    ExternalLink,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph } from '@/components/data';
import type { Article, ArticleVersion, GlobalEdge, ServiceCatalog } from '@/lib/types/objects';
import { updateArticleAction, deleteArticleAction } from '@/app/actions/objects';

interface ArticleDetailPageProps {
    article: Article;
    versions: ArticleVersion[];
    edges: GlobalEdge[];
    serviceCatalogs: ServiceCatalog[];
}

export function ArticleDetailPage({ article, versions, edges, serviceCatalogs }: ArticleDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data.articles');
    const commonT = useTranslations('Data.common');
    const isLight = theme === 'light';

    // State
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);
    const [selectedVersionNum, setSelectedVersionNum] = useState<number>(article.effective_version_number);

    // Form State
    const [title, setTitle] = useState(article.latest_version.title);
    const [summary, setSummary] = useState(article.latest_version.summary || '');
    const [markdown, setMarkdown] = useState(article.latest_version.markdown);
    const [sourceSystem, setSourceSystem] = useState(article.latest_version.source_system || '');
    const [sourceUrl, setSourceUrl] = useState(article.latest_version.source_url || '');
    const [isActive, setIsActive] = useState(article.is_active);

    const catalogName = serviceCatalogs.find((c) => c.oid === article.service_catalog_id)?.name || 'Unknown';
    const filteredEdges = edgeFilter ? edges.filter((e) => {
        const connectedObject = e.from_oid === article.oid ? e.to_object : e.from_object;
        return connectedObject?.object_type === edgeFilter;
    }) : edges;

    const displayedVersion = versions.find(v => v.version_number === selectedVersionNum) || article.latest_version;
    const isLatest = selectedVersionNum === article.latest_version.version_number;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('title', title);
            formData.set('markdown', markdown);
            if (summary) formData.set('summary', summary);
            if (sourceSystem) formData.set('source_system', sourceSystem);
            if (sourceUrl) formData.set('source_url', sourceUrl);
            formData.set('is_active', String(isActive));

            await updateArticleAction(article.oid, formData);
            setIsEditing(false);
            // Refresh logic handled by server action revalidation, but local state update might be needed or page reload
            // Ideally we'd update the local state with the new version from response, but for simplicity we rely on router.refresh
            router.refresh();
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('deleteConfirm'))) return;
        setIsPending(true);
        try {
            await deleteArticleAction(article.oid);
            router.push('/data/articles');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setTitle(article.latest_version.title);
        setSummary(article.latest_version.summary || '');
        setMarkdown(article.latest_version.markdown);
        setSourceSystem(article.latest_version.source_system || '');
        setSourceUrl(article.latest_version.source_url || '');
        setIsActive(article.is_active);
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/articles')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                                <FileText className="w-5 h-5" />
                            </div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('detail')}</h1>
                        </div>
                    </div>
                    {!isEditing && (
                        <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-300'}`}>
                                <History className="w-4 h-4" />
                                <select
                                    value={selectedVersionNum}
                                    onChange={(e) => setSelectedVersionNum(Number(e.target.value))}
                                    className="bg-transparent outline-none cursor-pointer"
                                >
                                    {versions.map(v => (
                                        <option key={v.version_number} value={v.version_number}>
                                            v{v.version_number} ({new Date(v.created_at).toLocaleDateString()})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors">
                                <Pencil className="w-4 h-4" />
                                <span>{commonT('edit')}</span>
                            </button>
                        </div>
                    )}

                    {/* Status Badge */}
                    {!isEditing && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${article.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {article.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            {article.is_active ? 'Active' : 'Inactive'}
                        </div>
                    )}
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>

                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('articleTitle')}</label>
                            {isEditing ? (
                                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full px-3 py-2 rounded-lg text-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`px-3 py-2 rounded-lg text-lg ${isLight ? 'text-slate-800 bg-slate-50' : 'text-white bg-white/5'}`}>{displayedVersion.title}</div>
                            )}
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('summary')}</label>
                            {isEditing ? (
                                <textarea rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`px-3 py-2 rounded-lg ${isLight ? 'text-slate-800 bg-slate-50' : 'text-white bg-white/5'}`}>{displayedVersion.summary || '-'}</div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Service Catalog */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('serviceCatalog')}</label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Layers className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{catalogName}</span>
                            </div>
                        </div>

                        {/* Created/Updated */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{commonT('updated')}</label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{new Date(displayedVersion.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    {/* Source Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('sourceSystem')}</label>
                            {isEditing ? (
                                <input type="text" value={sourceSystem} onChange={(e) => setSourceSystem(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`} placeholder="e.g. Confluence" />
                            ) : (
                                <div className={`px-3 py-2 rounded-lg ${isLight ? 'text-slate-800 bg-slate-50' : 'text-white bg-white/5'}`}>{displayedVersion.source_system || '-'}</div>
                            )}
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('sourceUrl')}</label>
                            {isEditing ? (
                                <input type="text" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`} placeholder="https://..." />
                            ) : (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    {displayedVersion.source_url ? (
                                        <a href={displayedVersion.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                                            <span className="truncate max-w-[200px]">{displayedVersion.source_url}</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    ) : (
                                        <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>-</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Content */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('content')}</label>
                        {isEditing ? (
                            <textarea
                                rows={15}
                                value={markdown}
                                onChange={(e) => setMarkdown(e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg font-mono text-sm ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`}
                            />
                        ) : (
                            <div className={`p-4 rounded-lg overflow-x-auto whitespace-pre-wrap font-mono text-sm ${isLight ? 'bg-slate-50 text-slate-800' : 'bg-white/5 text-gray-300'}`}>
                                {displayedVersion.markdown}
                            </div>
                        )}
                    </div>

                    {/* Status Toggle (only in edit) */}
                    {isEditing && (
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Status</label>
                            <button
                                type="button"
                                onClick={() => setIsActive(!isActive)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
                            >
                                {isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                <span className="text-sm font-medium">{isActive ? 'Active' : 'Inactive'}</span>
                            </button>
                        </div>
                    )}

                    {/* Actions */}
                    {isEditing ? (
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>{commonT('save')}</span>
                            </button>
                            <button onClick={handleCancel} disabled={isPending} className={`px-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>{commonT('cancel')}</button>
                        </div>
                    ) : (
                        <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                            <button onClick={handleDelete} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span>{commonT('delete')} {t('title')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{commonT('edgeRelationships')}</h2>
                    <ObjectGraph
                        oid={article.oid}
                        objectType="article"
                        descriptor={article.latest_version.title}
                        edges={filteredEdges}
                        onFilterChange={setEdgeFilter}
                        selectedFilter={edgeFilter}
                    />
                </div>
            </div>
        </div>
    );
}
