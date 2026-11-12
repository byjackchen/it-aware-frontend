'use client';

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { NavLink } from '@/components/navigation/NavLink';
import { usePermissions } from '@/lib/contexts/user-context';
import { legacyMenu, permits } from '@/lib/legacy/menu';

/** The old-style menu's links, by grouping and task, for the views the person may open. */
export function LegacyMenuList() {
    const locale = useLocale();
    const pathname = usePathname();
    const checks = usePermissions();
    const groups = legacyMenu(locale, requires => permits(requires, checks));
    if (groups.length === 0) return null;

    return (
        <nav data-testid="legacy-menu" aria-label="Menu" className="w-60 shrink-0 overflow-y-auto px-3 py-4 text-sm">
            {groups.map(group => (
                <section key={group.code} className="mb-4">
                    <h2 className="px-2 mb-1 text-xs font-semibold uppercase tracking-wide opacity-60">{group.label}</h2>
                    {group.tasks.map(task => (
                        <div key={task.code} className="mb-2">
                            {task.links.length > 1 && <h3 className="px-2 py-1 font-medium">{task.label}</h3>}
                            <ul>
                                {task.links.map(link => (
                                    <li key={link.href}>
                                        <NavLink
                                            href={link.href}
                                            aria-current={pathname === link.href ? 'page' : undefined}
                                            className={`block rounded-md px-2 py-1 ${
                                                task.links.length > 1 ? 'pl-4' : ''
                                            } ${pathname === link.href ? 'sidebar-active' : 'hover:opacity-80'}`}
                                        >
                                            {task.links.length > 1 ? link.label : task.label}
                                        </NavLink>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </section>
            ))}
        </nav>
    );
}
