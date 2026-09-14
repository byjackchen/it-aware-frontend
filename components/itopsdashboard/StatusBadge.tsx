'use client';

import { useTranslations } from 'next-intl';
import { statusClass } from '@/lib/itopsdashboard/domain/format';
import type { MetricStatus } from '@/lib/itopsdashboard/domain/types';

/**
 * 状态徽章。类名沿用原型（badge green/yellow/red/gray），文案走 next-intl。
 *
 * 注意 gray/PENDING 是「待接入」而非「不健康」——它有两种成因：数据源未接入，
 * 或健康规则尚未定稿（见 lib/itopsdashboard/domain/status.ts）。
 */
export function StatusBadge({ status }: { status: MetricStatus }) {
    const t = useTranslations('ItopsOverview');
    return <span className={`badge ${statusClass(status)}`}>● {t(`status.${status}`)}</span>;
}
