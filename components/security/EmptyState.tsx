'use client';

import { MousePointerClick } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function EmptyState() {
  const t = useTranslations('Security');

  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-full theme-empty-bg flex items-center justify-center mb-4">
        <MousePointerClick className="w-8 h-8 theme-empty-icon" />
      </div>
      <p className="theme-text-muted">{t('common.selectItem')}</p>
    </div>
  );
}
