import { describe, expect, it } from 'vitest';
import { marked, sections, step } from '@/lib/search/sections';
import type { SearchGroup } from '@/lib/types/search';

const result = (id: string) => ({ id, title: id, subtitle: null, opens: `/tasks/${id}` });
const group = (kind: string, ...ids: string[]): SearchGroup => ({ kind, label: null, results: ids.map(result) });

describe('the search panel sections', () => {
    it('puts the tasks first and the records after, each kind its own group', () => {
        const found = sections([group('incident', 'i1', 'i2'), group('task', 't1', 't2'), group('article', 'a1')]);
        expect(found.tasks.map(item => item.id)).toEqual(['t1', 't2']);
        expect(found.objects.map(({ kind }) => kind)).toEqual(['incident', 'article']);
        // The arrow keys walk both sections in the order shown.
        expect(found.flat.map(item => item.id)).toEqual(['t1', 't2', 'i1', 'i2', 'a1']);
    });

    it('leaves out a record group with no result, and has no section for nothing found', () => {
        expect(sections([group('worker'), group('task', 't1')])).toEqual({
            tasks: [result('t1')], objects: [], flat: [result('t1')],
        });
        expect(sections([])).toEqual({ tasks: [], objects: [], flat: [] });
    });
});

describe('the arrow keys', () => {
    it('move down and up through the results, and wrap at either end', () => {
        expect(step(0, 3, 'ArrowDown')).toBe(1);
        expect(step(2, 3, 'ArrowDown')).toBe(0);
        expect(step(1, 3, 'ArrowUp')).toBe(0);
        expect(step(0, 3, 'ArrowUp')).toBe(2);
    });

    it('stay put when nothing was found', () => {
        expect(step(0, 0, 'ArrowDown')).toBe(0);
        expect(step(0, 0, 'ArrowUp')).toBe(0);
    });
});

describe('marking what matched', () => {
    it('cuts the text at every match, whatever the case', () => {
        expect(marked('IT Incidents and incident SLA', 'Incident')).toEqual([
            { text: 'IT ', hit: false },
            { text: 'Incident', hit: true },
            { text: 's and ', hit: false },
            { text: 'incident', hit: true },
            { text: ' SLA', hit: false },
        ]);
        expect(marked('incident', ' incident ')).toEqual([{ text: 'incident', hit: true }]);
    });

    it('leaves text without the query, or with an empty query, whole', () => {
        expect(marked('Workers', 'incident')).toEqual([{ text: 'Workers', hit: false }]);
        expect(marked('Workers', '  ')).toEqual([{ text: 'Workers', hit: false }]);
        expect(marked('', 'x')).toEqual([]);
    });
});
