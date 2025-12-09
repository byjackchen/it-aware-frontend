'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { createUser } from '../actions';

export function UserForm() {
  const t = useTranslations('Security');
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSystemUser, setIsSystemUser] = useState(false);
  const [password, setPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('username', username);
    formData.set('email', email);
    formData.set('full_name', fullName);
    formData.set('is_active', String(isActive));
    formData.set('is_system_user', String(isSystemUser));
    if (isSystemUser && password) {
      formData.set('password', password);
    }

    startTransition(async () => {
      const result = await createUser(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  };

  const handleCancel = () => {
    router.push('/security/users');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b theme-border-panel flex items-center justify-between">
        <h2 className="text-lg font-semibold theme-text-primary">{t('users.createUser')}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg theme-btn-neutral"
          >
            <X className="w-4 h-4" />
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || !username}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('common.create')}
          </button>
        </div>
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit} className="flex-1 p-4 overflow-y-auto">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-1 theme-text-label">
              {t('users.username')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm theme-input"
              placeholder={t('users.usernamePlaceholder')}
              required
            />
            <p className="mt-1 text-xs theme-text-muted">{t('common.uniqueIdentifier')}</p>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium mb-1 theme-text-label">{t('users.fullName')}</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm theme-input"
              placeholder={t('users.fullNamePlaceholder')}
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1 theme-text-label">{t('users.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm theme-input"
              placeholder={t('users.emailPlaceholder')}
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 theme-checkbox"
              />
              <span className="text-sm theme-text-label">{t('common.active')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isSystemUser}
                onChange={(e) => setIsSystemUser(e.target.checked)}
                className="w-4 h-4 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 theme-checkbox"
              />
              <span className="text-sm theme-text-label">{t('users.systemUserLabel')}</span>
            </label>
          </div>

          {/* Password (only for system users) */}
          {isSystemUser && (
            <div>
              <label className="block text-sm font-medium mb-1 theme-text-label">
                {t('users.password')} <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm theme-input"
                placeholder="Enter password (min 8 characters)"
                required
              />
              <p className="mt-1 text-xs theme-text-muted">{t('users.passwordMinHint')}</p>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
