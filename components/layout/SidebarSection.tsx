import { useState } from 'react';
import { NavLink } from '@/components/navigation/NavLink';
import { ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import type { MenuItem } from '@/lib/types/menu';

interface SidebarSectionProps {
    labelKey: string;
    items: MenuItem[];
    pathname: string;
    t: (key: string) => string;
    isLight: boolean;
    checkMenuAccess: (permissions: MenuItem['permissions']) => boolean;
    globalActiveHref: string | null;
    /** When set, the header renders as a prominent group title (icon + brighter,
     * normal-case label) instead of the default faint uppercase divider. */
    icon?: LucideIcon;
}

export function SidebarSection({ labelKey, items, pathname, t, isLight, checkMenuAccess, globalActiveHref, icon: Icon }: SidebarSectionProps) {
    const [isOpen, setIsOpen] = useState(true); // Open by default
    const authorizedItems = items.filter(item => checkMenuAccess(item.permissions));

    if (authorizedItems.length === 0) return null;

    /**
     * Use the global longest-prefix activeHref computed in Sidebar.tsx
     * so that sibling sections can't "steal" the highlight via their own
     * longest-prefix logic. When globalActiveHref is null the section falls
     * back to its local longest-prefix rule.
     */
    const activeHref = globalActiveHref ?? (() => {
        const matching = authorizedItems
            .map((it) => it.href)
            .filter(
                (href) =>
                    pathname === href || (href !== '/' && pathname.startsWith(href + '/')),
            )
        if (matching.length === 0) return null
        return matching.reduce((a, b) => (b.length > a.length ? b : a))
    })()

    return (
        <div className="space-y-1">
            {/* Section Header — prominent (with icon) for domain groups, faint
                uppercase divider otherwise. */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={
                    Icon
                        ? `w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold
                           ${isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-gray-200 hover:bg-white/5'}
                           transition-colors`
                        : `w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider
                           ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-gray-500 hover:text-gray-300'}
                           transition-colors`
                }
            >
                <span className="flex items-center gap-2.5">
                    {Icon && <Icon className="w-4 h-4 text-blue-400" />}
                    <span>{t(labelKey)}</span>
                </span>
                {isOpen ? (
                    <ChevronDown className={Icon ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                ) : (
                    <ChevronRight className={Icon ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
                )}
            </button>

            {/* Section Items */}
            {isOpen && (
                <div className="space-y-1 pl-2">
                    {authorizedItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = item.href === activeHref;

                        return (
                            <NavLink
                                key={item.href}
                                href={item.href}
                                className={`
                                    flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                                    ${isActive
                                        ? 'sidebar-active'
                                        : isLight
                                            ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                    }
                                `}
                            >
                                {Icon && <Icon className="w-4 h-4" />}
                                <span>{t(item.labelKey!)}</span>
                            </NavLink>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
