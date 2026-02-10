'use client';

/**
 * Persona Profile Page - Client Component
 * 
 * Displays a user-centric behavioral persona profile that captures:
 * - Who the person is in their daily work
 * - What they are trying to accomplish  
 * - How they behave under normal conditions
 */

import { useTheme } from '@/lib/contexts/theme-context';
import { useTranslations } from 'next-intl';
import {
    User,
    Target,
    AlertCircle,
    Calendar,
    Activity,
    MessageSquare,
    FileText,
    Check,
    X,
    Phone,
    Building2,
    Monitor,
    Laptop,
    Smartphone,
    Box,
    AppWindow,
} from 'lucide-react';
import type { Persona } from '@/lib/types/persona';
import type { Worker } from '@/lib/types/objects';
import { WorkerSelector } from './WorkerSelector';

interface PersonaProfilePageProps {
    persona: Persona;
    currentWorker: Worker;
}

export function PersonaProfilePage({ persona, currentWorker }: PersonaProfilePageProps) {
    const { theme } = useTheme();
    const t = useTranslations('Persona');
    const isLight = theme === 'light';

    // Style classes
    const cardClass = `rounded-xl border p-5 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`;
    const sectionTitleClass = `text-sm font-semibold uppercase tracking-wider mb-3 ${isLight ? 'text-slate-400' : 'text-gray-500'}`;
    const labelClass = `text-xs font-medium ${isLight ? 'text-slate-400' : 'text-gray-500'}`;
    const valueClass = `text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`;
    const listItemClass = `flex items-start gap-2 text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`;
    const tagClass = `px-3 py-1 rounded-full text-xs font-medium ${isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-300'}`;
    const placeholderClass = `italic ${isLight ? 'text-slate-400' : 'text-gray-500'}`;

    const isPlaceholder = (text: string) => text.includes('Placeholder');

    return (
        <div className="h-[calc(100vh-4rem)] overflow-y-auto">
            {/* Header */}
            <div className={`sticky top-0 z-10 px-6 py-6 border-b ${isLight ? 'bg-white/95 border-slate-200' : 'bg-[#0a0a0f]/95 border-white/10'} backdrop-blur-sm`}>
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-semibold ${isLight ? 'bg-gradient-to-br from-purple-100 to-pink-100 text-purple-600' : 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400'}`}>
                            {persona.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1">
                            <h1 className={`text-2xl font-bold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {persona.name}
                            </h1>
                            <p className={`text-base ${isPlaceholder(persona.title) ? placeholderClass : (isLight ? 'text-slate-600' : 'text-gray-400')}`}>
                                {persona.title}
                            </p>
                            <p className={`text-sm mt-1 ${isPlaceholder(persona.tagline) ? placeholderClass : (isLight ? 'text-slate-500' : 'text-gray-500')}`}>
                                &ldquo;{persona.tagline}&rdquo;
                            </p>
                        </div>
                        {/* Worker Selector */}
                        <WorkerSelector currentWorker={currentWorker} />
                    </div>
                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mt-4">
                        {persona.tags.map((tag, i) => (
                            <span key={i} className={isPlaceholder(tag) ? `${tagClass} ${placeholderClass}` : tagClass}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>


            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-6 py-6">
                <div className="flex gap-6">
                    {/* Sidebar - Sticky */}
                    <div className="w-72 flex-shrink-0">
                        <div className="sticky top-36 space-y-4">
                            {/* Basic Profile */}
                            <div className={cardClass}>
                                <div className={sectionTitleClass}>
                                    <User className="w-4 h-4 inline-block mr-2" />
                                    {t('basicProfile.title')}
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <div className={labelClass}>{t('basicProfile.role')}</div>
                                        <div className={isPlaceholder(persona.basicProfile.role) ? placeholderClass : valueClass}>
                                            {persona.basicProfile.role}
                                        </div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{t('basicProfile.experience')}</div>
                                        <div className={isPlaceholder(persona.basicProfile.experience) ? placeholderClass : valueClass}>
                                            {persona.basicProfile.experience}
                                        </div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{t('basicProfile.workMode')}</div>
                                        <div className={valueClass}>{persona.basicProfile.workMode}</div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{t('basicProfile.onCall')}</div>
                                        <div className={`flex items-center gap-1 ${valueClass}`}>
                                            {persona.basicProfile.onCall ? (
                                                <><Phone className="w-3 h-3 text-green-500" /> {t('common.yes')}</>
                                            ) : (
                                                <><span className="text-gray-400">—</span> {t('common.no')}</>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Context */}
                            <div className={cardClass}>
                                <div className={sectionTitleClass}>
                                    <Building2 className="w-4 h-4 inline-block mr-2" />
                                    {t('context.title')}
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <div className={labelClass}>{t('context.team')}</div>
                                        <div className={isPlaceholder(persona.context.team) ? placeholderClass : valueClass}>
                                            {persona.context.team}
                                        </div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{t('context.product')}</div>
                                        <div className={isPlaceholder(persona.context.product) ? placeholderClass : valueClass}>
                                            {persona.context.product}
                                        </div>
                                    </div>
                                    <div>
                                        <div className={labelClass}>{t('context.environment')}</div>
                                        <div className={isPlaceholder(persona.context.environment) ? placeholderClass : valueClass}>
                                            {persona.context.environment}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Softwares */}
                            <div className={cardClass}>
                                <div className={sectionTitleClass}>
                                    <AppWindow className="w-4 h-4 inline-block mr-2" />
                                    {t('softwares.title')}
                                </div>
                                {persona.softwares.length === 0 ? (
                                    <div className={placeholderClass}>{t('softwares.empty')}</div>
                                ) : (
                                    <ul className="space-y-2">
                                        {persona.softwares.map((sw, i) => (
                                            <li key={i} className={sw.isPlaceholder ? placeholderClass : valueClass}>
                                                {sw.name}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Hardwares */}
                            <div className={cardClass}>
                                <div className={sectionTitleClass}>
                                    <Laptop className="w-4 h-4 inline-block mr-2" />
                                    {t('hardwares.title')}
                                </div>
                                {persona.hardwares.length === 0 ? (
                                    <div className={placeholderClass}>{t('hardwares.empty')}</div>
                                ) : (
                                    <ul className="space-y-3">
                                        {persona.hardwares.map((hw) => {
                                            // Choose icon based on hardware type
                                            let HwIcon = Box;
                                            const type = hw.hardware_type.toLowerCase();
                                            if (type.includes('laptop') || type.includes('macbook')) HwIcon = Laptop;
                                            else if (type.includes('monitor') || type.includes('display')) HwIcon = Monitor;
                                            else if (type.includes('phone') || type.includes('mobile')) HwIcon = Smartphone;

                                            return (
                                                <li key={hw.oid} className="flex items-start gap-2">
                                                    <HwIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                                    <div>
                                                        <div className={valueClass}>
                                                            {hw.hardware_type}{hw.model ? ` - ${hw.model}` : ''}
                                                        </div>
                                                        {hw.serial_number && (
                                                            <div className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                                SN: {hw.serial_number}
                                                            </div>
                                                        )}
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main View - Scrollable */}
                    <div className="flex-1 space-y-6">
                        {/* Goals & Motivations */}
                        <div className={cardClass}>
                            <div className={sectionTitleClass}>
                                <Target className="w-4 h-4 inline-block mr-2" />
                                {t('goals.title')}
                            </div>
                            <ul className="space-y-2">
                                {persona.goalsMotivations.map((goal, i) => (
                                    <li key={i} className={listItemClass}>
                                        <span className="text-green-500 mt-0.5">•</span>
                                        <span className={isPlaceholder(goal) ? placeholderClass : ''}>{goal}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Pain Points */}
                        <div className={cardClass}>
                            <div className={sectionTitleClass}>
                                <AlertCircle className="w-4 h-4 inline-block mr-2" />
                                {t('painPoints.title')}
                            </div>
                            <ul className="space-y-2">
                                {persona.painPoints.map((pain, i) => (
                                    <li key={i} className={listItemClass}>
                                        <span className="text-red-500 mt-0.5">•</span>
                                        <span className={isPlaceholder(pain) ? placeholderClass : ''}>{pain}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Daily Workflow */}
                        <div className={cardClass}>
                            <div className={sectionTitleClass}>
                                <Calendar className="w-4 h-4 inline-block mr-2" />
                                {t('workflow.title')}
                            </div>
                            <div className="space-y-4">
                                {persona.dailyWorkflow.map((period, i) => (
                                    <div key={i}>
                                        <div className={`font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                            {period.period}:
                                        </div>
                                        <ul className="space-y-1 ml-4">
                                            {period.activities.map((activity, j) => (
                                                <li key={j} className={listItemClass}>
                                                    <span className="text-blue-500 mt-0.5">•</span>
                                                    <span className={isPlaceholder(activity) ? placeholderClass : ''}>{activity}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Behavior Patterns */}
                        <div className={cardClass}>
                            <div className={sectionTitleClass}>
                                <Activity className="w-4 h-4 inline-block mr-2" />
                                {t('behavior.title')}
                            </div>
                            <ul className="space-y-2">
                                {persona.behaviorPatterns.map((pattern, i) => (
                                    <li key={i} className={listItemClass}>
                                        <span className="text-purple-500 mt-0.5">•</span>
                                        <span className={isPlaceholder(pattern) ? placeholderClass : ''}>{pattern}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Communication Preferences */}
                        <div className={cardClass}>
                            <div className={sectionTitleClass}>
                                <MessageSquare className="w-4 h-4 inline-block mr-2" />
                                {t('communication.title')}
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <div className={`text-xs font-medium text-green-500 mb-2`}>{t('communication.preferred')}</div>
                                    <ul className="space-y-1">
                                        {persona.communicationPreferences.preferred.map((pref, i) => (
                                            <li key={i} className={listItemClass}>
                                                <Check className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
                                                <span className={isPlaceholder(pref) ? placeholderClass : ''}>{pref}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <div className={`text-xs font-medium text-red-500 mb-2`}>{t('communication.avoided')}</div>
                                    <ul className="space-y-1">
                                        {persona.communicationPreferences.avoided.map((avoid, i) => (
                                            <li key={i} className={listItemClass}>
                                                <X className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                                                <span className={isPlaceholder(avoid) ? placeholderClass : ''}>{avoid}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Notes / Research */}
                        <div className={cardClass}>
                            <div className={sectionTitleClass}>
                                <FileText className="w-4 h-4 inline-block mr-2" />
                                {t('notes.title')}
                            </div>
                            <ul className="space-y-2">
                                {persona.notes.map((note, i) => (
                                    <li key={i} className={listItemClass}>
                                        <span className="text-gray-400 mt-0.5">•</span>
                                        <span className={isPlaceholder(note) ? placeholderClass : ''}>{note}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
