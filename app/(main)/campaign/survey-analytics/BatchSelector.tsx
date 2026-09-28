'use client';

import { useEffect, useState } from 'react';
import { Filter, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface SurveyBatchItem {
    oid: string;
    name: string;
    status: string;
    total_count: number;
}

interface BatchSelectorProps {
    selectedBatchOid: string;
    onBatchChange: (batch: SurveyBatchItem) => void;
    isLight: boolean;
}

export function BatchSelector({ selectedBatchOid, onBatchChange, isLight }: BatchSelectorProps) {
    const t = useTranslations('SurveyAnalytics');
    const [batches, setBatches] = useState<SurveyBatchItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchBatches() {
            try {
                const res = await fetch('/api/campaigns/survey_batchs?limit=100');
                if (!res.ok) return;
                const data = await res.json();
                const items: SurveyBatchItem[] = data.items || [];
                setBatches(items);
                if (!selectedBatchOid && items.length > 0) {
                    onBatchChange(items[0]);
                }
            } catch { /* ignore */ }
            finally { setIsLoading(false); }
        }
        void fetchBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isLoading) {
        return (
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('loadingBatches')}</span>
            </div>
        );
    }

    if (batches.length === 0) {
        return (
            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('noBatches')}</p>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Filter className={`w-4 h-4 ${isLight ? 'text-slate-500' : 'text-gray-500'}`} />
            <select
                value={selectedBatchOid}
                onChange={(e) => {
                    const batch = batches.find((item) => item.oid === e.target.value);
                    if (batch) onBatchChange(batch);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium ${isLight
                    ? 'bg-white border border-slate-200 text-slate-800'
                    : 'bg-white/10 border border-white/10 text-white'
                } focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
            >
                {batches.map((b) => (
                    <option key={b.oid} value={b.oid}>
                        {b.name} ({b.status} · {b.total_count.toLocaleString()} {t('recipients')})
                    </option>
                ))}
            </select>
        </div>
    );
}
