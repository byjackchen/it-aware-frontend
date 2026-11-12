import { describe, expect, it } from 'vitest';
import { GROUPINGS, TASKS, byGrouping, groupingName, named, pageHref, resolvePage } from '@/lib/tasks/catalog';
import { PERMISSIONS } from '@/lib/config/permissions';

describe('the checked-in catalog', () => {
  it('holds the 23 tasks and 62 views of contract v3, in four groupings', () => {
    expect(TASKS).toHaveLength(23);
    expect(TASKS.flatMap(task => task.views)).toHaveLength(62);
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

describe('pageHref: a task address to the page where it lives today', () => {
  it('maps a view address to its old base', () => {
    expect(pageHref('/tasks/it-incidents')).toBe('/data/incidents');
    expect(pageHref('/tasks/it-tickets/active')).toBe('/operation-teams/ops-dashboard');
    expect(pageHref('/tasks/it-aging-work/incidents')).toBe('/operation-teams/ops-dashboard/aging-incidents');
    expect(pageHref('/tasks/access/who-has-what')).toBe('/auth/tasks');
  });

  it('keeps a record or sub-page, and a query or fragment', () => {
    expect(pageHref('/tasks/it-incidents/abc')).toBe('/data/incidents/abc');
    expect(pageHref('/tasks/workers/locations/new')).toBe('/data/locations/new');
    expect(pageHref('/tasks/it-knowledge/library/catalog/xyz')).toBe('/knowledge/catalog/xyz');
    expect(pageHref('/tasks/it-incidents?state=open')).toBe('/data/incidents?state=open');
    expect(pageHref('/tasks/it-incidents/abc#notes')).toBe('/data/incidents/abc#notes');
  });

  it("opens a task's own address at its first view", () => {
    expect(pageHref('/tasks/workers')).toBe('/data/workers');
    expect(pageHref('/tasks/workers?x=1')).toBe('/data/workers?x=1');
  });

  it('matches on segment boundaries only', () => {
    expect(pageHref('/tasks/it-incidentsx')).toBe('/tasks/it-incidentsx');
  });

  it('returns any other address as it is', () => {
    expect(pageHref('/home')).toBe('/home');
    expect(pageHref('/data/organizations/abc')).toBe('/data/organizations/abc');
    expect(pageHref('/tasks/no-such-task')).toBe('/tasks/no-such-task');
  });
});

describe('resolvePage: the task and view of the page shown', () => {
  const at = (pathname: string) => {
    const found = resolvePage(pathname);
    return found && `${found.task.code}/${found.view.slug}`;
  };

  it('finds the view at its old base, or under it, longest first', () => {
    expect(at('/data/incidents')).toBe('it-incidents/incidents');
    expect(at('/data/incidents/abc')).toBe('it-incidents/incidents');
    expect(at('/operation-teams/ops-dashboard')).toBe('it-tickets/active');
    expect(at('/operation-teams/ops-dashboard/incidents')).toBe('it-tickets/incidents');
    expect(at('/operation-teams/ops-dashboard/aging-incidents')).toBe('it-aging-work/incidents');
    expect(at('/knowledge/faqs')).toBe('it-knowledge/library');
    expect(at('/auth/tasks')).toBe('access/who-has-what');
  });

  it('finds the view at its new address too', () => {
    expect(at('/tasks/it-tickets/vip')).toBe('it-tickets/vip');
    expect(at('/tasks/it-incidents/abc')).toBe('it-incidents/incidents');
  });

  it('finds nothing for a page that is no task', () => {
    expect(at('/')).toBeNull();
    expect(at('/home')).toBeNull();
    expect(at('/ohla-journey')).toBeNull();
    expect(at('/data/incidents-archive')).toBeNull();
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
