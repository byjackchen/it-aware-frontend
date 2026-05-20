'use client';

import { useRef, useState, useCallback } from 'react';
import { Lightbulb, Loader2, RefreshCw } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

interface Props {
    startDate: string;  // YYYY-MM-DD
    endDate: string;    // YYYY-MM-DD
}

const PERSPECTIVES = [
    { value: 'general', label: '综合分析' },
    { value: 'escalation', label: '升级率' },
    { value: 'knowledge_gap', label: '知识库缺口' },
    { value: 'trend', label: '趋势对比' },
    { value: 'user_habit', label: '用户习惯' },
    { value: 'custom', label: '自定义' },
] as const;

type PerspectiveKey = (typeof PERSPECTIVES)[number]['value'];

export function OperationalAdvicePanel({ startDate, endDate }: Props) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // Refs for mutable state that doesn't need to trigger re-renders
    const cacheRef = useRef<Map<string, string>>(new Map());
    const abortRef = useRef<Map<string, AbortController>>(new Map());
    const loadingSetRef = useRef<Set<string>>(new Set());  // Tracks in-flight keys without closure issues

    const [perspective, setPerspective] = useState<PerspectiveKey>('general');
    const [customInput, setCustomInput] = useState('');
    // Per-key state (keyed by cacheKey = `startDate|endDate|perspective`)
    const [results, setResults] = useState<Map<string, string>>(new Map());
    const [loadingKeys, setLoadingKeys] = useState<Set<string>>(new Set());
    const [errors, setErrors] = useState<Map<string, string>>(new Map());

    const effectivePerspective = perspective === 'custom' ? customInput.trim() : perspective;
    const cacheKey = `${startDate}|${endDate}|${effectivePerspective}`;

    const currentAdvice = results.get(cacheKey) ?? null;
    const isLoading = loadingKeys.has(cacheKey);
    const error = errors.get(cacheKey) ?? null;

    const generate = useCallback(async (ep: string, ck: string, forceRefresh = false) => {
        if (!ep) return;

        // Return cached result if available
        if (!forceRefresh && cacheRef.current.has(ck)) {
            setResults(prev => new Map(prev).set(ck, cacheRef.current.get(ck)!));
            setErrors(prev => { const m = new Map(prev); m.delete(ck); return m; });
            return;
        }

        // Avoid duplicate in-flight requests for the same key
        if (!forceRefresh && loadingSetRef.current.has(ck)) return;

        // Cancel any previous request for this same key (e.g. on force refresh)
        abortRef.current.get(ck)?.abort();
        const ctrl = new AbortController();
        abortRef.current.set(ck, ctrl);

        loadingSetRef.current.add(ck);
        setLoadingKeys(prev => new Set(prev).add(ck));
        setErrors(prev => { const m = new Map(prev); m.delete(ck); return m; });
        setResults(prev => { const m = new Map(prev); m.delete(ck); return m; });

        try {
            const res = await fetch('/api/objects/interactions/report/faq-advice', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ start_date: startDate, end_date: endDate, perspective: ep }),
                signal: ctrl.signal,
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || `HTTP ${res.status}`);
            }
            const data = await res.json() as { advice: string };
            cacheRef.current.set(ck, data.advice);
            setResults(prev => new Map(prev).set(ck, data.advice));
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return;
            setErrors(prev => new Map(prev).set(ck, e instanceof Error ? e.message : 'Failed to generate advice'));
        } finally {
            loadingSetRef.current.delete(ck);
            setLoadingKeys(prev => { const s = new Set(prev); s.delete(ck); return s; });
        }
    }, [startDate, endDate]);

    const chipBase = 'px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border';
    const chipActive = isLight
        ? 'bg-blue-600 text-white border-blue-600'
        : 'bg-blue-500 text-white border-blue-500';
    const chipInactive = isLight
        ? 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
        : 'bg-white/5 text-gray-300 border-white/10 hover:border-white/30';

    const hasResult = !!currentAdvice && !isLoading;
    const showGenerateBtn = perspective !== 'custom' && !isLoading;

    return (
        <div>
            {/* Perspective chips */}
            <div className="flex flex-wrap gap-2 mt-3 items-center">
                {PERSPECTIVES.map(({ value, label }) => {
                    const ep = value === 'custom' ? '' : value;
                    const ck = `${startDate}|${endDate}|${ep}`;
                    const chipLoading = value !== 'custom' && loadingKeys.has(ck);
                    return (
                        <button
                            key={value}
                            onClick={() => setPerspective(value)}
                            className={`${chipBase} ${perspective === value ? chipActive : chipInactive} flex items-center gap-1`}
                        >
                            {chipLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                            {label}
                        </button>
                    );
                })}
            </div>

            {/* Custom input */}
            {perspective === 'custom' && (
                <div className="mt-2 flex gap-2 items-start">
                    <textarea
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        placeholder="描述你想分析的角度，例如：重点分析 QNC 类型的问题..."
                        maxLength={500}
                        rows={2}
                        className={`flex-1 rounded-lg border px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                            isLight
                                ? 'bg-white border-slate-200 text-slate-700 placeholder-slate-400'
                                : 'bg-white/5 border-white/10 text-gray-200 placeholder-gray-500'
                        }`}
                    />
                    <button
                        onClick={() => generate(effectivePerspective, cacheKey)}
                        disabled={isLoading || !effectivePerspective}
                        className={`mt-0.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isLight ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-blue-500 text-white hover:bg-blue-600'
                        }`}
                    >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
                        生成
                    </button>
                </div>
            )}

            {/* Generate / Re-generate button */}
            {showGenerateBtn && (
                <div className="mt-3">
                    <button
                        onClick={() => generate(effectivePerspective, cacheKey, hasResult)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            isLight
                                ? 'border-blue-300 text-blue-600 hover:bg-blue-50'
                                : 'border-blue-500/40 text-blue-400 hover:bg-blue-500/10'
                        }`}
                    >
                        {hasResult
                            ? <><RefreshCw className="w-3.5 h-3.5" />重新生成</>
                            : <><Lightbulb className="w-3.5 h-3.5" />生成建议</>
                        }
                    </button>
                </div>
            )}

            {/* Loading state for current perspective */}
            {isLoading && (
                <div className={`mt-3 rounded-lg border px-4 py-5 flex flex-col items-center gap-2 ${
                    isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'
                }`}>
                    <Loader2 className={`w-5 h-5 animate-spin ${isLight ? 'text-blue-500' : 'text-blue-400'}`} />
                    <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                        AI 正在分析数据，生成建议中...
                    </span>
                </div>
            )}

            {/* Error */}
            {error && !isLoading && (
                <div className={`mt-3 rounded-lg border px-3 py-2 flex items-center gap-2 ${
                    isLight ? 'border-red-200 bg-red-50' : 'border-red-500/20 bg-red-500/10'
                }`}>
                    <p className="text-xs text-red-500 flex-1">{error}</p>
                    <button
                        onClick={() => generate(effectivePerspective, cacheKey)}
                        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 shrink-0"
                    >
                        <RefreshCw className="w-3 h-3" /> 重试
                    </button>
                </div>
            )}

            {/* Result */}
            {currentAdvice && !isLoading && (
                <div className={`mt-3 rounded-lg border p-3 ${
                    isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'
                }`}>
                    <div className={`text-xs leading-relaxed space-y-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                        {currentAdvice.split(/\n\n+/).map((para, i) => (
                            <p key={i}>{para.trim()}</p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
