'use client';

/**
 * Permission create page client component.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Lock, Loader2 } from 'lucide-react';
import { createPermission } from '../../actions';

export function PermissionCreatePage() {
    const t = useTranslations('Security');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [domain, setDomain] = useState('');
    const [resource, setResource] = useState('');
    const [action, setAction] = useState('');

    const permissionCode = [domain, resource, action].filter(Boolean).join(':') || 'domain:resource:action';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData();
        formData.set('domain', domain);
        formData.set('resource', resource);
        formData.set('action', action);
        startTransition(async () => {
            const result = await createPermission(formData);
            if (result.success) {
                router.push('/security/permissions');
            }
        });
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => router.push('/security/permissions')}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <div className="flex items-center gap-3">
                        <Lock className="w-6 h-6 text-blue-400" />
                        <h1 className="text-2xl font-semibold text-white">{t('permissions.create')}</h1>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-6">
                    {/* Permission Code Preview */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('permissions.codePreview')}
                        </label>
                        <div className="px-3 py-2 rounded-lg theme-input-readonly font-mono text-blue-400 text-lg">
                            {permissionCode}
                        </div>
                    </div>

                    {/* Domain, Resource, Action */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                {t('permissions.domain')} *
                            </label>
                            <input
                                type="text"
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                placeholder="e.g., auth"
                                className="w-full px-3 py-2 rounded-lg theme-input"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                {t('permissions.resource')} *
                            </label>
                            <input
                                type="text"
                                value={resource}
                                onChange={(e) => setResource(e.target.value)}
                                placeholder="e.g., users"
                                className="w-full px-3 py-2 rounded-lg theme-input"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                {t('permissions.action')} *
                            </label>
                            <input
                                type="text"
                                value={action}
                                onChange={(e) => setAction(e.target.value)}
                                placeholder="e.g., read"
                                className="w-full px-3 py-2 rounded-lg theme-input"
                                required
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={isPending || !domain || !resource || !action}
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
                            onClick={() => router.push('/security/permissions')}
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
