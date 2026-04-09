'use client';

/**
 * Hardware detail page client component — read-only, 8 clustered card layout.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    HardDrive,
    Check,
    X,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Hardware } from '@/lib/types/objects';

interface HardwareDetailPageProps {
    hardware: Hardware;
}

function formatCurrency(value: string | null): string {
    if (!value) return '—';
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return value;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function HardwareDetailPage({ hardware }: HardwareDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data.hardwares.detail');
    const isLight = theme === 'light';
    const notSet = t('notSet');

    const cardClass = `rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`;
    const headingClass = `text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`;
    const labelClass = `text-xs font-medium uppercase tracking-wide mb-1 ${isLight ? 'text-slate-400' : 'text-gray-500'}`;
    const valueClass = `text-sm ${isLight ? 'text-slate-800' : 'text-white'}`;

    function Field({ label, value }: { label: string; value: string | null | undefined }) {
        return (
            <div>
                <div className={labelClass}>{label}</div>
                <div className={valueClass}>{value || notSet}</div>
            </div>
        );
    }

    function BoolField({ label, value }: { label: string; value: boolean | null | undefined }) {
        if (value === null || value === undefined) {
            return <Field label={label} value={null} />;
        }
        return (
            <div>
                <div className={labelClass}>{label}</div>
                <span className={`inline-flex items-center gap-1 text-sm ${value ? 'text-green-500' : isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                    {value ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {value ? t('yes') : t('no')}
                </span>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/data/hardwares')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center
                        ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
                    `}>
                        <HardDrive className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {hardware.serial_number}
                            </h1>
                            {hardware.is_active ? (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                    {t('active')}
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                    {t('inactive')}
                                </span>
                            )}
                        </div>
                        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            {hardware.model_display_name || hardware.model_category || '—'}
                        </p>
                    </div>
                </div>

                {/* Identity */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('identity')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('serialNumber')} value={hardware.serial_number} />
                        <Field label={t('assetTag')} value={hardware.asset_tag} />
                        <Field label={t('assetNumber')} value={hardware.asset_number} />
                    </div>
                </div>

                {/* Model */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('model')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('modelCategory')} value={hardware.model_category} />
                        <Field label={t('modelDisplayName')} value={hardware.model_display_name} />
                        <Field label={t('modelName')} value={hardware.model_name} />
                        <Field label={t('mainCategory')} value={hardware.main_category} />
                        <Field label={t('assetFunction')} value={hardware.asset_function} />
                        <Field label={t('assetOwner')} value={hardware.asset_owner} />
                    </div>
                </div>

                {/* Assignment */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('assignment')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('assignedToDisplayName')} value={hardware.assigned_to_display_name} />
                        <Field label={t('assignedToUsername')} value={hardware.assigned_to_username} />
                        <div>
                            <div className={labelClass}>{t('workerOid')}</div>
                            {hardware.worker_oid ? (
                                <button
                                    onClick={() => router.push(`/data/workers/${hardware.worker_oid}`)}
                                    className="text-sm text-blue-500 hover:underline"
                                >
                                    {hardware.worker_oid}
                                </button>
                            ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                    Unassigned
                                </span>
                            )}
                        </div>
                        <Field label={t('employmentType')} value={hardware.employment_type} />
                        <Field label={t('employmentStartDate')} value={hardware.employment_start_date} />
                        <Field label={t('assignedDate')} value={hardware.assigned_date} />
                        <Field label={t('firstAssignedDate')} value={hardware.first_assigned_date} />
                    </div>
                </div>

                {/* Location / Org */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('locationOrg')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('company')} value={hardware.company} />
                        <Field label={t('businessGroup')} value={hardware.business_group} />
                        <Field label={t('department')} value={hardware.department} />
                        <Field label={t('location')} value={hardware.location} />
                        <Field label={t('officeId')} value={hardware.office_id} />
                        <Field label={t('regionCode')} value={hardware.region_code} />
                        <Field label={t('region')} value={hardware.region} />
                        <Field label={t('officeRegion')} value={hardware.office_region} />
                        <Field label={t('stockRoom')} value={hardware.stock_room} />
                    </div>
                </div>

                {/* Cost */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('cost')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('costValue')} value={formatCurrency(hardware.cost)} />
                        <Field label={t('costCenter')} value={hardware.cost_center} />
                        <Field label={t('procuredCostCenter')} value={hardware.procured_cost_center} />
                        <Field label={t('residualValue')} value={formatCurrency(hardware.residual_value)} />
                        <Field label={t('residualDate')} value={hardware.residual_date} />
                        <BoolField label={t('budgetByOit')} value={hardware.budget_by_oit} />
                        <BoolField label={t('costByOit')} value={hardware.cost_by_oit} />
                    </div>
                </div>

                {/* Status */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('status')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className={labelClass}>{t('assetStatus')}</div>
                            {hardware.asset_status ? (
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                                    hardware.asset_status === 'In use'
                                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                        : hardware.asset_status === 'Retired'
                                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                }`}>
                                    {hardware.asset_status}
                                </span>
                            ) : (
                                <div className={valueClass}>{notSet}</div>
                            )}
                        </div>
                        <Field label={t('substatus')} value={hardware.substatus} />
                        <Field label={t('retiredDate')} value={hardware.retired_date} />
                        <Field label={t('scheduledRetirement')} value={hardware.scheduled_retirement} />
                    </div>
                </div>

                {/* Verification */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('verification')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('verificationStatus')} value={hardware.verification_status} />
                        <Field label={t('verifiedDate')} value={hardware.verified_date} />
                        <Field label={t('verifiedBy')} value={hardware.verified_by} />
                    </div>
                </div>

                {/* Provenance */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('provenance')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('erpCreatedBy')} value={hardware.erp_created_by} />
                        <Field label={t('erpCreatedDate')} value={hardware.erp_created_date} />
                        <Field label={t('erpUpdatedDate')} value={hardware.erp_updated_date} />
                        <Field label={t('ownedBy')} value={hardware.owned_by} />
                    </div>
                </div>
            </div>
        </div>
    );
}
