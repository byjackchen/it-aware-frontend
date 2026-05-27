'use client';

/**
 * Prompts management (client). List on the left, editor on the right.
 * CRUD via the /api/agentops/prompts proxy. Create = POST, edit = PUT,
 * delete = DELETE (soft-deactivate on the backend).
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus, Save, Trash2, Loader2, ScrollText } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Prompt, PromptListItem } from '@/lib/types/objects';

interface Props {
    initialPrompts: PromptListItem[];
}

const BLANK = { name: '', display_name: '', kind: 'prompt', description: '', content: '', is_active: true };

export function PromptsManagementPage({ initialPrompts }: Props) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [prompts, setPrompts] = useState<PromptListItem[]>(initialPrompts);
    const [selectedOid, setSelectedOid] = useState<string | null>(null);
    const [mode, setMode] = useState<'create' | 'edit'>('create');
    const [form, setForm] = useState({ ...BLANK });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const inputClass = `w-full px-3 py-2 rounded-lg text-sm ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`;
    const labelClass = `block text-xs font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`;

    const loadList = useCallback(async () => {
        const res = await fetch('/api/agentops/prompts?limit=200');
        if (res.ok) setPrompts((await res.json()).items);
    }, []);

    const startCreate = () => {
        setSelectedOid(null);
        setMode('create');
        setForm({ ...BLANK });
    };

    const selectPrompt = useCallback(async (oid: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/agentops/prompts/${oid}`);
            if (res.ok) {
                const p = (await res.json()) as Prompt;
                setSelectedOid(oid);
                setMode('edit');
                setForm({
                    name: p.name,
                    display_name: p.display_name || '',
                    kind: p.kind || 'prompt',
                    description: p.description || '',
                    content: p.content || '',
                    is_active: p.is_active,
                });
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initialPrompts.length === 0) startCreate();
    }, [initialPrompts.length]);

    const handleSave = async () => {
        if (!form.content.trim() || (mode === 'create' && !form.name.trim())) {
            alert('Name and content are required.');
            return;
        }
        setSaving(true);
        try {
            let res: Response;
            if (mode === 'create') {
                res = await fetch('/api/agentops/prompts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: form.name.trim(),
                        display_name: form.display_name.trim() || undefined,
                        kind: form.kind.trim() || 'prompt',
                        description: form.description.trim() || undefined,
                        content: form.content,
                    }),
                });
            } else {
                res = await fetch(`/api/agentops/prompts/${selectedOid}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        display_name: form.display_name.trim() || undefined,
                        kind: form.kind.trim() || undefined,
                        description: form.description.trim() || undefined,
                        content: form.content,
                        is_active: form.is_active,
                    }),
                });
            }
            if (!res.ok) {
                alert(`Save failed: ${res.status}`);
                return;
            }
            const saved = (await res.json()) as Prompt;
            await loadList();
            await selectPrompt(saved.oid);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedOid || !confirm('Deactivate this prompt?')) return;
        const res = await fetch(`/api/agentops/prompts/${selectedOid}`, { method: 'DELETE' });
        if (res.ok) {
            await loadList();
            startCreate();
        }
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className={`text-2xl font-semibold flex items-center gap-2 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        <ScrollText className="w-6 h-6 text-purple-400" /> Prompts
                    </h1>
                    <button
                        onClick={startCreate}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm"
                    >
                        <Plus className="w-4 h-4" /> New prompt
                    </button>
                </div>
                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    Reusable role/persona instruction bundles. Attach them to an agent (Agents → prompts)
                    and they&apos;re injected as the agent&apos;s role preamble at the start of each conversation. A skill is one kind of prompt.
                </p>

                <div className="flex flex-col lg:flex-row gap-4">
                    {/* List */}
                    <div className={`lg:w-80 shrink-0 rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <div className={`px-3 py-2 text-xs font-semibold ${isLight ? 'text-slate-600 border-b border-slate-100' : 'text-gray-300 border-b border-white/10'}`}>
                            {prompts.length} prompt{prompts.length === 1 ? '' : 's'}
                        </div>
                        <div className="max-h-[520px] overflow-y-auto">
                            {prompts.map((p) => (
                                <button
                                    key={p.oid}
                                    onClick={() => void selectPrompt(p.oid)}
                                    data-testid={`prompt-row-${p.oid}`}
                                    className={`w-full text-left px-3 py-2 border-b text-sm transition-colors ${isLight ? 'border-slate-50 hover:bg-slate-50' : 'border-white/5 hover:bg-white/5'} ${selectedOid === p.oid ? 'bg-purple-500/10' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-green-400' : 'bg-gray-500'}`} />
                                        <span className="font-medium truncate flex-1">{p.display_name || p.name}</span>
                                        <span className="text-[10px] text-[var(--text-secondary)]">v{p.version}</span>
                                    </div>
                                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 pl-3.5">{p.kind} · {p.name}</div>
                                </button>
                            ))}
                            {prompts.length === 0 && (
                                <div className="px-3 py-6 text-center text-xs text-[var(--text-secondary)]">No prompts yet.</div>
                            )}
                        </div>
                    </div>

                    {/* Editor */}
                    <div className={`flex-1 rounded-xl border p-5 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <div className="flex items-center justify-between">
                            <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                {mode === 'create' ? 'New prompt' : `Editing: ${form.name}`}
                            </h2>
                            {loading && <Loader2 className="w-4 h-4 animate-spin text-[var(--text-secondary)]" />}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                                <label className={labelClass}>Name (unique key)</label>
                                <input
                                    type="text" value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    disabled={mode === 'edit'}
                                    className={`${inputClass} ${mode === 'edit' ? 'opacity-60' : ''}`}
                                    placeholder="qa-triage-agent"
                                    data-testid="prompt-name"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Display name</label>
                                <input type="text" value={form.display_name}
                                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                                    className={inputClass} placeholder="QA Triage Agent" />
                            </div>
                            <div>
                                <label className={labelClass}>Kind</label>
                                <input type="text" value={form.kind}
                                    onChange={(e) => setForm({ ...form, kind: e.target.value })}
                                    className={inputClass} placeholder="role | skill | system | prompt" />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Description</label>
                            <input type="text" value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className={inputClass} placeholder="What role/behaviour this prompt defines" />
                        </div>

                        <div>
                            <label className={labelClass}>Content (prepended as the agent&apos;s role preamble)</label>
                            <textarea value={form.content}
                                onChange={(e) => setForm({ ...form, content: e.target.value })}
                                rows={14}
                                className={`${inputClass} font-mono text-xs leading-relaxed`}
                                placeholder="You are a QA triage agent. When given a closed incident, determine whether…"
                                data-testid="prompt-content" />
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => void handleSave()}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50 text-sm"
                                    data-testid="prompt-save"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span>{mode === 'create' ? 'Create prompt' : 'Save changes'}</span>
                                </button>
                                {mode === 'edit' && (
                                    <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                        <input type="checkbox" checked={form.is_active}
                                            onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                                        Active
                                    </label>
                                )}
                            </div>
                            {mode === 'edit' && (
                                <button onClick={() => void handleDelete()}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm">
                                    <Trash2 className="w-4 h-4" /> Deactivate
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
