'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

export interface DeleteBatchModalLabels {
    title: string;
    description: string;
    typeToConfirm: string;
    confirm: string;
    cancel: string;
}

interface DeleteBatchModalProps {
    isOpen: boolean;
    batchName: string;
    isPending: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
    labels: DeleteBatchModalLabels;
}

export function DeleteBatchModal({
    isOpen,
    batchName,
    isPending,
    error,
    onCancel,
    onConfirm,
    labels,
}: DeleteBatchModalProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [typedName, setTypedName] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isPending) onCancel();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, isPending, onCancel]);

    if (!isOpen) return null;

    const expected = batchName.trim();
    const isMatch = expected.length > 0 && typedName.trim() === expected;
    const isConfirmDisabled = !isMatch || isPending;

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => {
                if (!isPending) onCancel();
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                className={`w-full max-w-md rounded-xl border p-5 space-y-4 shadow-xl ${
                    isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-slate-900'
                }`}
            >
                <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
                        <Trash2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                        <h2 className={`text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {labels.title}
                        </h2>
                        <p className={`mt-1 text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                            {labels.description}
                        </p>
                    </div>
                </div>

                <div>
                    <label
                        className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}
                    >
                        {labels.typeToConfirm}
                    </label>
                    <input
                        type="text"
                        value={typedName}
                        onChange={(event) => setTypedName(event.target.value)}
                        disabled={isPending}
                        autoFocus
                        className={`w-full px-2 py-1.5 rounded-md border text-sm ${
                            isLight
                                ? 'border-slate-300 text-slate-900'
                                : 'border-white/10 bg-slate-900/80 text-white'
                        } disabled:opacity-60`}
                    />
                </div>

                {error && (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isPending}
                        className={`px-3 py-1.5 rounded-md border text-sm ${
                            isLight
                                ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                                : 'border-white/10 text-gray-200 hover:bg-white/10'
                        } disabled:opacity-60`}
                    >
                        {labels.cancel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isConfirmDisabled}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-rose-400/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
                    >
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        <span>{labels.confirm}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
