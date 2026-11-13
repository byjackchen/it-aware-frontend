import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import contract from '@/lib/tasks/contract-v3.json';
import committed from './registry.json';
import {
    buildRegistry,
    fillPattern,
    findEntry,
    matchPattern,
    placeholders,
    serializeRegistry,
    type Contract,
} from './build';

describe('the generated registry', () => {
    it('is what the builder makes from the contract (regenerate: node lib/legacy/build-registry.mjs)', () => {
        const built = buildRegistry(contract as Contract);
        expect(built).toEqual(committed);
        const file = readFileSync(join(process.cwd(), 'lib', 'legacy', 'registry.json'), 'utf-8');
        expect(serializeRegistry(built)).toBe(file);
    });

    it('holds what a redirect needs and nothing else: the old address, the new one, the type', () => {
        const built = buildRegistry(contract as Contract);
        expect(Object.keys(built)).toEqual(['source', 'version', 'entries']);
        expect(built.entries).toHaveLength(108);
        for (const entry of built.entries) expect(Object.keys(entry)).toEqual(['old', 'new', 'type']);
    });
});

describe('patterns', () => {
    it('match segment by segment and capture each placeholder', () => {
        expect(matchPattern('/data/workers/[oid]', '/data/workers/w-1')).toEqual({ oid: 'w-1' });
        expect(matchPattern('/data/clusters/[label]', '/data/clusters/a%20b')).toEqual({ label: 'a%20b' });
        expect(matchPattern('/ohla-journey/[section]', '/ohla-journey/gaps')).toEqual({ section: 'gaps' });
        expect(matchPattern('/', '/')).toEqual({});
    });

    it('do not match a different length, a different fixed segment, or an empty placeholder', () => {
        expect(matchPattern('/data/workers/[oid]', '/data/workers')).toBeNull();
        expect(matchPattern('/data/workers/[oid]', '/data/workers/w-1/x')).toBeNull();
        expect(matchPattern('/data/workers/[oid]', '/data/systems/w-1')).toBeNull();
        expect(matchPattern('/data/workers/[oid]', '/data/workers/')).toBeNull();
    });

    it('fill and list their placeholders', () => {
        expect(fillPattern('/tasks/workers/clusters/[label]', { label: 'x' })).toBe('/tasks/workers/clusters/x');
        expect(fillPattern('/tasks/jobs', {})).toBe('/tasks/jobs');
        expect(placeholders('/a/[oid]/b/[section]')).toEqual(['oid', 'section']);
        expect(placeholders('/a')).toEqual([]);
    });

    it('prefer the entry with more fixed segments, whatever the order', () => {
        const entries = [{ old: '/a/[oid]' }, { old: '/a/new' }, { old: '/a/[oid]/b' }];
        expect(findEntry(entries, '/a/new')?.entry.old).toBe('/a/new');
        expect(findEntry([...entries].reverse(), '/a/new')?.entry.old).toBe('/a/new');
        expect(findEntry(entries, '/a/7')).toEqual({ entry: { old: '/a/[oid]' }, values: { oid: '7' } });
        expect(findEntry(entries, '/b')).toBeNull();
    });
});
