'use client';

import { useState, useCallback } from 'react';
import { Link2, Search, Copy, Check, AlertCircle, Loader2, ClipboardList } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

interface Survey {
    number: string;
    state: string;
    due_date: string;
    assigned_to: string;
    url: string;
}

interface IncidentResult {
    incident: {
        number: string;
        description: string;
        state: string;
        caller: string;
    };
    surveys: Survey[];
}

function CopyButton({ text, isLight }: { text: string; isLight: boolean }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }, [text]);

    return (
        <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                copied
                    ? isLight ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400'
                    : isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-white/10 hover:bg-white/20 text-gray-300'
            }`}
        >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制'}
        </button>
    );
}

export function SurveyLookup() {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<IncidentResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const cardBg = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/[0.03]';
    const inputBg = isLight
        ? 'border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500'
        : 'border-white/20 bg-white/5 text-white placeholder-gray-500 focus:border-blue-400 focus:ring-blue-400';

    const handleSearch = useCallback(async () => {
        const number = input.trim().toUpperCase();
        if (!number) return;

        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const res = await fetch(`/api/ssc/survey?number=${encodeURIComponent(number)}`);
            const data = await res.json();

            if (!res.ok) {
                if (res.status === 404) {
                    setError('找不到该工单，请确认工单号是否正确');
                } else if (res.status === 400) {
                    setError('工单号格式不正确，请输入 INC 开头的工单号（如 INC0120020）');
                } else {
                    setError('查询失败，请稍后重试');
                }
            } else {
                setResult(data);
            }
        } catch {
            setError('网络异常，请检查连接后重试');
        } finally {
            setLoading(false);
        }
    }, [input]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    }, [handleSearch]);

    return (
        <div className="p-8 space-y-6 max-w-3xl">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'
                }`}>
                    <Link2 className="w-6 h-6" />
                </div>
                <div>
                    <h1 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>调查链接查询</h1>
                    <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>输入工单号获取满意度调查链接</p>
                </div>
            </div>

            {/* Search Input */}
            <div className={`rounded-xl border p-5 ${cardBg}`}>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="INC0120020"
                        className={`flex-1 rounded-lg border px-4 py-3 text-base outline-none focus:ring-1 transition-colors ${inputBg}`}
                    />
                    <button
                        onClick={handleSearch}
                        disabled={loading || !input.trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                        查询
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className={`flex items-start gap-3 rounded-xl border p-5 ${
                    isLight ? 'border-red-200 bg-red-50' : 'border-red-500/20 bg-red-500/10'
                }`}>
                    <AlertCircle className={`h-5 w-5 mt-0.5 shrink-0 ${isLight ? 'text-red-500' : 'text-red-400'}`} />
                    <p className={`text-sm ${isLight ? 'text-red-700' : 'text-red-300'}`}>{error}</p>
                </div>
            )}

            {/* Result */}
            {result && (
                <div className={`rounded-xl border p-5 space-y-5 ${cardBg}`}>
                    {/* Incident info */}
                    <div className="flex items-start gap-4">
                        <ClipboardList className={`h-5 w-5 mt-0.5 shrink-0 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <div className="min-w-0">
                            <p className={`text-base font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {result.incident.number}
                                <span className={`ml-2 text-sm font-normal ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                    {result.incident.state}
                                </span>
                            </p>
                            <p className={`text-sm mt-1 truncate ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                {result.incident.description}
                            </p>
                            <p className={`text-sm mt-1 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                报告人：{result.incident.caller}
                            </p>
                        </div>
                    </div>

                    <div className={`border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`} />

                    {/* Surveys */}
                    {result.surveys.length === 0 ? (
                        <div className={`rounded-lg p-4 text-sm ${isLight ? 'bg-amber-50 border border-amber-200' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                            <p className={`font-medium mb-1 ${isLight ? 'text-amber-800' : 'text-amber-300'}`}>该工单暂无满意度调查问卷</p>
                            <p className={`text-xs leading-relaxed ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                                可能原因：工单尚未关闭、ServiceNow 尚未生成调查，或该工单类型不触发调查流程。
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {result.surveys.map((survey) => (
                                <div key={survey.number} className={`rounded-lg p-4 ${
                                    isLight ? 'bg-slate-50' : 'bg-white/5'
                                }`}>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div>
                                            <span className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                                {survey.number}
                                            </span>
                                            <span className={`ml-2 text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                {survey.state}
                                            </span>
                                        </div>
                                        <div className={`text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                            截止：{survey.due_date}
                                        </div>
                                    </div>
                                    <p className={`text-sm mb-3 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                        接收人：{survey.assigned_to}
                                    </p>
                                    <div className={`flex items-center gap-2 rounded border px-3 py-2 ${
                                        isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-black/20'
                                    }`}>
                                        <span className={`flex-1 truncate text-sm font-mono ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                            {survey.url}
                                        </span>
                                        <CopyButton text={survey.url} isLight={isLight} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
