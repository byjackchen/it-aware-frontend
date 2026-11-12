import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import contract from '@/lib/tasks/contract-v3.json';
import { pageAddress } from '@/lib/tasks/pages';
import { placeholders } from './build';
import { findLegacy, newAddress, REGISTRY } from './registry';

const KEPT = ['/', '/home', '/access-denied'];
const views = contract.tasks.flatMap(task => task.views.map(view => ({ task, view })));
const viewAddresses = views.map(({ view }) => view.address);

/** Every page.tsx under app/(main), as its address. */
function pageAddresses(): string[] {
    const root = join(process.cwd(), 'app', '(main)');
    return readdirSync(root, { recursive: true, encoding: 'utf-8' })
        .filter(file => file === 'page.tsx' || file.endsWith('/page.tsx'))
        .map(file => pageAddress(`app/(main)/${file}`))
        .sort();
}

describe('the legacy registry', () => {
    it('has an entry for every page under app/(main)', () => {
        const pages = pageAddresses();
        expect(pages.length).toBeGreaterThan(100);
        const missing = pages.filter(address => !REGISTRY.entries.some(entry => entry.old === address));
        expect(missing).toEqual([]);
    });

    it('holds every entry of the contract legacy list, unchanged, and nothing else', () => {
        const entries = REGISTRY.entries.map(({ old, new: to, type }) => ({ old, new: to, type }));
        expect(entries).toEqual(contract.legacy);
        expect(new Set(entries.map(e => e.old)).size).toBe(entries.length);
    });

    it('sends each old address to a kept address, a view address, or a record under a view', () => {
        const unknown = REGISTRY.entries
            .filter(entry => entry.type !== 'pattern')
            .map(entry => entry.new)
            .filter(
                to =>
                    !KEPT.includes(to) &&
                    !viewAddresses.some(address => to === address || to.startsWith(`${address}/`)),
            );
        expect(unknown).toEqual([]);
    });

    it('keeps exactly the kept addresses in place', () => {
        const inPlace = REGISTRY.entries.filter(entry => entry.new === entry.old).map(entry => entry.old);
        expect(inPlace.sort()).toEqual([...KEPT].sort());
        expect(REGISTRY.entries.filter(entry => entry.type === 'kept').map(entry => entry.old).sort()).toEqual(
            [...KEPT].sort(),
        );
    });

    it("sends every view's old address to that view's address (the pattern entry included)", () => {
        const wrong = views
            .filter(({ view }) => newAddress(view.old_base) !== view.address)
            .map(({ view }) => view.old_base);
        expect(wrong).toEqual([]);
    });

    it('only uses placeholders in a new address that its old address captures', () => {
        for (const entry of REGISTRY.entries) {
            for (const name of placeholders(entry.new)) {
                expect(placeholders(entry.old)).toContain(name);
            }
        }
    });

    it('lists each contract view exactly once for the menu, on view and pattern entries only', () => {
        const items = REGISTRY.entries.flatMap(entry => entry.menu);
        expect(items.map(item => item.new).sort()).toEqual([...viewAddresses].sort());
        expect(new Set(items.map(item => item.position)).size).toBe(views.length);
        const hosts = new Set(REGISTRY.entries.filter(entry => entry.menu.length > 0).map(entry => entry.type));
        expect([...hosts].sort()).toEqual(['pattern', 'view']);
        for (const item of items) {
            expect(newAddress(item.old)).toBe(item.new);
        }
    });
});

describe('the matcher', () => {
    it('carries every kind of placeholder over', () => {
        expect(newAddress('/data/workers/w-1')).toBe('/tasks/workers/workers/w-1');
        expect(newAddress('/data/clusters/blue%20team')).toBe('/tasks/workers/clusters/blue%20team');
        expect(newAddress('/ohla-journey/timeline')).toBe('/tasks/ohla-journey-dashboard/timeline');
        expect(newAddress('/knowledge/catalog/c-9')).toBe('/tasks/it-knowledge/library/catalog/c-9');
        const kinds = new Set(REGISTRY.entries.flatMap(entry => placeholders(entry.old)));
        expect([...kinds].sort()).toEqual(['label', 'oid', 'section']);
    });

    it('prefers a fixed segment to a placeholder', () => {
        expect(findLegacy('/auth/accounts/new')?.entry.old).toBe('/auth/accounts/new');
        expect(findLegacy('/auth/accounts/a-1')?.entry.old).toBe('/auth/accounts/[oid]');
    });

    it('matches whole addresses only, ignoring a trailing slash', () => {
        expect(newAddress('/data/workers/')).toBe('/tasks/workers/workers');
        expect(newAddress('/')).toBe('/');
        expect(newAddress('/data/workers/w-1/history')).toBeNull();
        expect(newAddress('/login')).toBeNull();
        expect(newAddress('/systems/llm_proxy/models')).toBe('/home');
    });
});
