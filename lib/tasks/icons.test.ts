import { describe, expect, it } from 'vitest';
import { TASKS } from '@/lib/tasks/catalog';
import { iconNamed, TASK_ICONS, taskIcon } from '@/lib/tasks/icons';

/** The icon of each task (lib/tasks/icons.ts). */

const pascal = (name: string) => name.split('-').map(part => part[0].toUpperCase() + part.slice(1)).join('');

describe('the icon map', () => {
    it('has the icon of every task of the catalog, and no other', () => {
        const named = TASKS.map(task => task.icon);
        expect(named.filter(name => !(name in TASK_ICONS))).toEqual([]);
        expect(Object.keys(TASK_ICONS).sort()).toEqual([...new Set(named)].sort());
    });

    it('maps each name to the lucide icon of that name', () => {
        for (const [name, Icon] of Object.entries(TASK_ICONS)) expect(Icon.displayName).toBe(pascal(name));
    });

    it("gives every task an icon of its own", () => {
        expect(new Set(TASKS.map(task => task.icon)).size).toBe(TASKS.length);
    });
});

describe('resolving an icon', () => {
    it('finds the icon of a task by its code', () => {
        expect(taskIcon('usages')).toBe(TASK_ICONS['chart-no-axes-column']);
        expect(taskIcon('it-incidents')).toBe(TASK_ICONS['triangle-alert']);
    });

    it('finds nothing for an unknown code or name, so the tile shows the letter', () => {
        expect(taskIcon('nowhere')).toBeNull();
        expect(iconNamed('no-such-icon')).toBeNull();
        expect(iconNamed('constructor')).toBeNull();
        expect(iconNamed('')).toBeNull();
        expect(iconNamed(null)).toBeNull();
        expect(iconNamed(undefined)).toBeNull();
    });
});
