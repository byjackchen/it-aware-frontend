'use client';

/**
 * Account create page client component.
 */

import { useState, useTransition } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { ArrowLeft, User, Loader2, Sparkles, Copy, Eye, EyeOff } from 'lucide-react';
import { createAccount } from '@/app/actions/security';

// Generate a 16-char strong password using Web Crypto.
// Excludes look-alikes (I/l/O/0/1) and quote/backslash to avoid shell escaping pain.
function generateRandomPassword(length = 16): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr, (n) => chars[n % chars.length]).join('');
}

export function AccountCreatePage() {
    const t = useTranslations('Auth');
    const router = useTransitionRouter();
    const [isPending, startTransition] = useTransition();
    const [username, setUsername] = useState('');
    const [accountType, setAccountType] = useState('user');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = () => {
        const pw = generateRandomPassword(16);
        setPassword(pw);
        setShowPassword(true);
    };

    const handleCopy = async () => {
        if (!password) return;
        await navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData();
        formData.set('username', username);
        formData.set('account_type', accountType);
        formData.set('is_active', 'true');
        formData.set('password', password);
        startTransition(async () => {
            const result = await createAccount(formData);
            if (result.success) {
                router.push('/auth/accounts');
            }
        });
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => router.push('/auth/accounts')}
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

                    {/* Account Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('accounts.type')} *
                        </label>
                        <select
                            value={accountType}
                            onChange={(e) => setAccountType(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg theme-input"
                        >
                            <option value="user">User</option>
                            <option value="system">System</option>
                            <option value="agent">Agent</option>
                        </select>
                    </div>

                    {/* Password — REQUIRED for all account types.
                        Admin can either type one or click Generate for a strong random one.
                        The created password is only visible during this session;
                        admin is warned to save/share it before submitting. */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('accounts.password')} *
                        </label>
                        <div className="flex gap-2">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setCopied(false);
                                }}
                                placeholder={t('accounts.passwordPlaceholder')}
                                className="flex-1 px-3 py-2 rounded-lg theme-input font-mono"
                                required
                                minLength={8}
                            />
                            <button
                                type="button"
                                onClick={handleGenerate}
                                title={t('accounts.passwordGenerate')}
                                className="px-3 py-2 rounded-lg theme-btn-neutral flex items-center gap-1"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span className="text-sm">{t('accounts.passwordGenerate')}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                title={showPassword ? t('accounts.passwordHide') : t('accounts.passwordShow')}
                                className="px-3 py-2 rounded-lg theme-btn-neutral"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={handleCopy}
                                disabled={!password}
                                title={t('accounts.passwordCopy')}
                                className="px-3 py-2 rounded-lg theme-btn-neutral disabled:opacity-50"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {copied
                                ? `✓ ${t('accounts.passwordCopied')}`
                                : t('accounts.passwordHintCreate')}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={isPending || !username || !password}
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
                            onClick={() => router.push('/auth/accounts')}
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
