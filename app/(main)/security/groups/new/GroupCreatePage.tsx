'use client';

/**
 * Group create page client component.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Users, Loader2 } from 'lucide-react';
import type { ScopeType } from '@/lib/types/security';
import { SCOPE_TYPES } from '@/lib/types/security';
import { createGroup } from '../../actions';

export function GroupCreatePage() {
    const t = useTranslations('Security');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [name, setName] = useState('');
    const [scopeType, setScopeType] = useState<ScopeType>('unconstrained');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData();
        formData.set('name', name);
        formData.set('scope_type', scopeType);
        startTransition(async () => {
            const result = await createGroup(formData);
            if (result.success) {
                router.push('/security/groups');
            }
        });
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => router.push('/security/groups')}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <div className="flex items-center gap-3">
                        <Users className="w-6 h-6 text-blue-400" />
                        <h1 className="text-2xl font-semibold text-white">{t('groups.create')}</h1>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('groups.name')} *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('groups.namePlaceholder')}
                            className="w-full px-3 py-2 rounded-lg theme-input"
                            required
                        />
                    </div>

                    {/* Scope Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('groups.scopeType')} *
                        </label>
                        <select
                            value={scopeType}
                            onChange={(e) => setScopeType(e.target.value as ScopeType)}
                            className="w-full px-3 py-2 rounded-lg theme-select"
                        >
                            {SCOPE_TYPES.map((st) => (
                                <option key={st.value} value={st.value}>
                                    {t(`groups.scope.${st.value}`)}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2">
                            {t(`groups.scopeHint.${scopeType}`)}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={isPending || !name}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                t('common.create')
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/security/groups')}
                            disabled={isPending}
                            className="px-4 py-2 rounded-lg theme-btn-neutral"
                        >
                            {t('common.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
