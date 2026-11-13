import { describe, expect, it, vi } from 'vitest';
import contract from '@/lib/tasks/contract-v3.json';
import type { Requires } from './build';
import { legacyMenu, permits } from './menu';

const everything = () => true;
/**
 * The tasks as the old-style menu has them: only the views that had a page
 * before the move. A view added since (View Usages) is in no old-style menu:
 * its backend answers 404 while the task UI is off.
 */
const moved = contract.tasks
    .map(t => ({ ...t, views: t.views.filter(v => v.old_base !== null) }))
    .filter(t => t.views.length > 0);

describe('the old-style menu', () => {
    it('lists every contract view that had an old address by grouping and task, in contract order, at the old addresses with the redirects off', () => {
        const menu = legacyMenu('en', everything, false);
        expect(menu.map(g => g.code)).toEqual(contract.groupings.map(g => g.code));
        expect(menu.flatMap(g => g.tasks.map(t => t.code))).toEqual(
            contract.groupings.flatMap(g => moved.filter(t => t.grouping === g.code).map(t => t.code)),
        );
        const workers = menu[0].tasks[0];
        expect(workers).toEqual({
            code: 'workers',
            label: 'Maintain Workers and Organizations',
            links: [
                { href: '/data/workers', label: 'Workers' },
                { href: '/data/organizations', label: 'Organizations' },
                { href: '/data/locations', label: 'Locations' },
                { href: '/data/clusters', label: 'Clusters' },
            ],
        });
        const links = menu.flatMap(g => g.tasks.flatMap(t => t.links));
        expect(links).toHaveLength(moved.reduce((n, t) => n + t.views.length, 0));
        expect(menu.flatMap(g => g.tasks.map(t => t.code))).not.toContain('usages');
        expect(links).toContainEqual({ href: '/ohla-journey/audit', label: 'Audit' });
    });

    it('links to the new addresses, the redirects being on since the pages moved', () => {
        const links = legacyMenu('en', everything).flatMap(g => g.tasks.flatMap(t => t.links));
        expect(links.map(l => l.href).sort()).toEqual(
            moved.flatMap(t => t.views.map(v => v.address)).sort(),
        );
    });

    it('speaks Chinese for zh and English otherwise', () => {
        expect(legacyMenu('zh', everything)[0].label).toBe('数据');
        expect(legacyMenu('zh', everything)[0].tasks[0].links[0].label).toBe('员工');
        expect(legacyMenu('fr', everything)[0].label).toBe('Data');
    });

    it('shows only the views whose rule is met, and drops empty tasks and groupings', () => {
        const can = (requires: Requires) => requires.codes.includes('ui:navigation:auth');
        const menu = legacyMenu('en', can);
        expect(menu.map(g => g.code)).toEqual(['administration']);
        expect(menu[0].tasks.map(t => t.code)).toEqual(['access']);
        expect(legacyMenu('en', () => false)).toEqual([]);
    });

    it("checks a rule with the user context's any or all check", () => {
        const checks = { hasAnyPermission: vi.fn(() => true), hasAllPermissions: vi.fn(() => false) };
        expect(permits({ check: 'any', codes: ['a:b:c'] }, checks)).toBe(true);
        expect(checks.hasAnyPermission).toHaveBeenCalledWith(['a:b:c']);
        expect(permits({ check: 'all', codes: ['a:b:c', 'd:e:f'] }, checks)).toBe(false);
        expect(checks.hasAllPermissions).toHaveBeenCalledWith(['a:b:c', 'd:e:f']);
    });
});
