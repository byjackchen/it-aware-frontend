import { describe, expect, it } from 'vitest';
import { GROUPINGS, TASKS, byGrouping, groupingName, named, openKey, pageHref, resolvePage } from '@/lib/tasks/catalog';
import { PERMISSIONS } from '@/lib/config/permissions';

describe('the checked-in catalog', () => {
  it('holds the 27 tasks and 74 views of contract v3 (Clusters and the Survey Analysis Dashboard retired, View IT CSAT and View Raw Records added, 2026-11-16; Ohla Router, the first external task, added 2026-11-17), in four groupings', () => {
    expect(TASKS).toHaveLength(27);
    expect(TASKS.flatMap(task => task.views)).toHaveLength(74);
    expect(GROUPINGS.map(grouping => grouping.code)).toEqual(['data', 'analytics', 'operations', 'administration']);
  });

  // Kept from the retired sidebar's check (lib/config/ohla-journey-menu.test.ts):
  // journey viewers, who hold no ui:navigation code, still have every report page.
  it('lets either the operations menu code or the journey permission open every Ohla Journey page', () => {
    const journey = TASKS.find(task => task.code === 'ohla-journey-dashboard')!;
    expect(journey.views).toHaveLength(8);
    for (const view of journey.views) {
      expect(view.requires).toEqual({
        check: 'any',
        codes: [PERMISSIONS.UI.NAVIGATION_OPERATION, PERMISSIONS.DASHBOARDS.OHLA_JOURNEY_READ],
      });
    }
  });
});

describe('pageHref: the page of a task address, which lives at that address since the move', () => {
  it('returns every address as it is, record, query and fragment included', () => {
    for (const address of [
      '/tasks/it-incidents',
      '/tasks/it-tickets/active',
      '/tasks/it-incidents/abc',
      '/tasks/workers/locations/new',
      '/tasks/it-knowledge/library/catalog/xyz',
      '/tasks/it-incidents?state=open',
      '/tasks/it-incidents/abc#notes',
      '/home',
    ]) {
      expect(pageHref(address)).toBe(address);
    }
  });

  it('is what every task address in the catalog opens', () => {
    for (const task of TASKS) {
      expect(pageHref(task.address)).toBe(task.address);
      for (const view of task.views) expect(pageHref(view.address)).toBe(view.address);
    }
  });
});

describe('resolvePage: the task and view of the page shown', () => {
  const at = (pathname: string) => {
    const found = resolvePage(pathname);
    return found && `${found.task.code}/${found.view.slug}`;
  };

  it('finds the view at its address, or under it, longest first', () => {
    expect(at('/tasks/it-incidents')).toBe('it-incidents/incidents');
    expect(at('/tasks/it-incidents/abc')).toBe('it-incidents/incidents');
    expect(at('/tasks/it-tickets/active')).toBe('it-tickets/active');
    expect(at('/tasks/it-tickets/incidents')).toBe('it-tickets/incidents');
    expect(at('/tasks/it-tickets/vip')).toBe('it-tickets/vip');
    expect(at('/tasks/it-aging-work/incidents')).toBe('it-aging-work/incidents');
    expect(at('/tasks/it-knowledge/library/catalog/xyz')).toBe('it-knowledge/library');
    expect(at('/tasks/it-knowledge/articles/abc')).toBe('it-knowledge/articles');
    expect(at('/tasks/access/who-has-what')).toBe('access/who-has-what');
  });

  it('finds nothing for a page that is no task, an old address included', () => {
    expect(at('/')).toBeNull();
    expect(at('/home')).toBeNull();
    expect(at('/tasks/ohla-journey-dashboard')).toBeNull();
    expect(at('/tasks/it-incidents-archive')).toBeNull();
    // Old addresses redirect before a page renders (lib/legacy/redirect.ts).
    expect(at('/data/incidents')).toBeNull();
    expect(at('/knowledge/faqs')).toBeNull();
  });
});

describe('openKey: what an open of a page is counted as', () => {
  it("is the same for a view's page and every record under it, so browsing records is one open", () => {
    expect(openKey('/tasks/it-incidents')).toBe('it-incidents/incidents');
    expect(openKey('/tasks/it-incidents/abc')).toBe('it-incidents/incidents');
    expect(openKey('/tasks/it-incidents/def')).toBe('it-incidents/incidents');
    expect(openKey('/tasks/workers/organizations/o-1')).toBe(openKey('/tasks/workers/organizations'));
  });

  it('changes with the view and with the task, and is null for a page that is no task', () => {
    expect(openKey('/tasks/workers/workers')).toBe('workers/workers');
    expect(openKey('/tasks/workers/organizations')).toBe('workers/organizations');
    expect(openKey('/tasks/it-tickets/vip')).toBe('it-tickets/vip');
    expect(openKey('/home')).toBeNull();
  });

  it('never holds a second slash: no task code or view slug has one', () => {
    for (const task of TASKS) {
      for (const view of task.views) expect(`${task.code}/${view.slug}`.split('/')).toEqual([task.code, view.slug]);
    }
  });
});

describe('names', () => {
  it('names a task and a grouping in the current language', () => {
    expect(named({ en: 'Data', zh: '数据' }, 'en')).toBe('Data');
    expect(named({ en: 'Data', zh: '数据' }, 'zh-CN')).toBe('数据');
    expect(groupingName('operations', 'en')).toBe('Operations');
    expect(groupingName('operations', 'zh')).toBe('运营');
    expect(groupingName('elsewhere', 'en')).toBe('elsewhere');
  });

  it('puts tasks under their grouping, in catalog order, an unknown grouping last', () => {
    const tasks = [
      { code: 'a', grouping: 'operations' },
      { code: 'b', grouping: 'elsewhere' },
      { code: 'c', grouping: 'data' },
      { code: 'd', grouping: 'operations' },
    ];
    expect(byGrouping(tasks).map(({ grouping, tasks: held }) => [grouping, held.map(task => task.code)])).toEqual([
      ['data', ['c']],
      ['operations', ['a', 'd']],
      ['elsewhere', ['b']],
    ]);
  });
});
