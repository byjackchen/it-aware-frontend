import { describe, expect, it } from 'vitest';
import { greetingAt, hourIn, pinnedRow } from '@/lib/tasks/home';
import type { Task } from '@/lib/types/tasks';

const task = (code: string): Task => ({
    code, name: { en: code, zh: code }, grouping: 'data', kind: 'internal', external_app: null,
    address: `/tasks/${code}`, keywords: [], views: [],
});
const row = (pinned: string[], adminSet: string[]) =>
    pinnedRow({ pinned: pinned.map(task), admin_set: adminSet.map(task) }).map(({ task: shown, own }) => [shown.code, own]);

describe('the Pinned row', () => {
    it("shows the person's own pins first, then what an administrator set", () => {
        expect(row(['b', 'a'], ['d', 'c'])).toEqual([['b', true], ['a', true], ['d', false], ['c', false]]);
    });

    it("shows a task in both lists once, as the person's own pin", () => {
        expect(row(['c', 'a'], ['b', 'c', 'd'])).toEqual([['c', true], ['a', true], ['b', false], ['d', false]]);
    });

    it('puts an unpinned task back at its administrator-set place', () => {
        expect(row(['a'], ['b', 'c', 'd'])).toEqual([['a', true], ['b', false], ['c', false], ['d', false]]);
    });

    it('is empty with nothing pinned or set', () => {
        expect(row([], [])).toEqual([]);
        expect(row([], ['a'])).toEqual([['a', false]]);
        expect(row(['a'], [])).toEqual([['a', true]]);
    });
});

describe('the greeting', () => {
    it('follows the time of day', () => {
        expect([0, 4, 5, 11, 12, 17, 18, 23].map(greetingAt)).toEqual(
            ['evening', 'evening', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening']
        );
    });

    it("reads the hour in the person's timezone", () => {
        const when = new Date('2026-11-12T23:30:00Z');
        expect(hourIn(when, 'UTC')).toBe(23);
        expect(hourIn(when, 'Asia/Shanghai')).toBe(7);
        expect(hourIn(new Date('2026-11-12T16:05:00Z'), 'Asia/Shanghai')).toBe(0);
    });
});
