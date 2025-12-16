'use client';

/**
 * Role create page client component.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Shield, Loader2 } from 'lucide-react';
import { createRole } from '../../actions';

export function RoleCreatePage() {
    const t = useTranslations('Security');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [name, setName] = useState('');
    const [includeDesc, setIncludeDesc] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData();
        formData.set('name', name);
        formData.set('include_desc', String(includeDesc));
        startTransition(async () => {
            const result = await createRole(formData);
            if (result.success) {
                router.push('/security/roles');
            }
        });
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => router.push('/security/roles')}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <div className="flex items-center gap-3">
                        <Shield className="w-6 h-6 text-blue-400" />
                        <h1 className="text-2xl font-semibold text-white">{t('roles.create')}</h1>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('roles.name')} *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('roles.namePlaceholder')}
                            className="w-full px-3 py-2 rounded-lg theme-input"
                            required
                        />
                    </div>

                    {/* Include Descendants */}
                    <div>
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={includeDesc}
                                onChange={(e) => setIncludeDesc(e.target.checked)}
                                className="w-5 h-5 rounded theme-checkbox"
                            />
                            <div>
                                <span className="text-white font-medium">{t('roles.includeDescendants')}</span>
                                <p className="text-sm text-gray-400 mt-0.5">
                                    {t('roles.includeDescHint')}
                                </p>
                            </div>
                        </label>
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
                            onClick={() => router.push('/security/roles')}
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
