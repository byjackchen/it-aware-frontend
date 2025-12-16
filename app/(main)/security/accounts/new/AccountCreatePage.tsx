'use client';

/**
 * Account create page client component.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, User, Loader2 } from 'lucide-react';
import { createAccount } from '../../actions';

export function AccountCreatePage() {
    const t = useTranslations('Security');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [username, setUsername] = useState('');
    const [isSystem, setIsSystem] = useState(false);
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData();
        formData.set('username', username);
        formData.set('is_system', String(isSystem));
        formData.set('is_active', 'true');
        if (password) {
            formData.set('password', password);
        }
        startTransition(async () => {
            const result = await createAccount(formData);
            if (result.success) {
                router.push('/security/accounts');
            }
        });
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => router.push('/security/accounts')}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <div className="flex items-center gap-3">
                        <User className="w-6 h-6 text-blue-400" />
                        <h1 className="text-2xl font-semibold text-white">{t('accounts.create')}</h1>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-6">
                    {/* Username */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('accounts.username')} *
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={t('accounts.usernamePlaceholder')}
                            className="w-full px-3 py-2 rounded-lg theme-input"
                            required
                        />
                    </div>

                    {/* System Account */}
                    <div>
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={isSystem}
                                onChange={(e) => setIsSystem(e.target.checked)}
                                className="w-5 h-5 rounded theme-checkbox"
                            />
                            <div>
                                <span className="text-white font-medium">{t('accounts.isSystem')}</span>
                                <p className="text-sm text-gray-400 mt-0.5">
                                    {t('accounts.isSystemHint')}
                                </p>
                            </div>
                        </label>
                    </div>

                    {/* Password (System accounts only) */}
                    {isSystem && (
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                {t('accounts.password')} *
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={t('accounts.passwordPlaceholder')}
                                className="w-full px-3 py-2 rounded-lg theme-input"
                                required
                                minLength={8}
                            />
                            <p className="text-xs text-gray-500 mt-1">{t('accounts.passwordHint')}</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={isPending || !username || (isSystem && !password)}
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
                            onClick={() => router.push('/security/accounts')}
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
