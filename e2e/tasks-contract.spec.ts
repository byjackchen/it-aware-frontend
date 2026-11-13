import fs from 'node:fs';
import path from 'node:path';
import { test, expect, request } from '@playwright/test';
import { API_URL } from './env';

/**
 * Drift check of the task catalog (contract v3, section 6; TODO00000140 A14):
 * the backend's GET /tasks/catalog must say what the frontend's checked-in copy
 * (lib/tasks/contract-v3.json) says, in the fields the contract fixes: the
 * groupings, and per task its code, names, grouping, address and icon, and per view
 * its slug, names, rule and address. The frontend's own fields (`old_code`,
 * `old_base`) and the backend's (`keywords`, `external_app`) are not compared.
 */

interface Names { en: string; zh: string }
interface Rule { check: string; codes: string[] }
interface View { slug: string; name: Names; requires: Rule; address: string }
interface Task { code: string; name: Names; grouping: string; address: string; icon: string; views: View[] }
interface Catalog { groupings: { code: string; name: Names }[]; tasks: Task[] }

/** The compared fields, in order. */
function compared(catalog: Catalog) {
  return {
    groupings: catalog.groupings.map(({ code, name }) => ({ code, name: { en: name.en, zh: name.zh } })),
    tasks: catalog.tasks.map((task) => ({
      code: task.code,
      name: { en: task.name.en, zh: task.name.zh },
      grouping: task.grouping,
      address: task.address,
      icon: task.icon,
      views: task.views.map((view) => ({
        slug: view.slug,
        name: { en: view.name.en, zh: view.name.zh },
        requires: { check: view.requires.check, codes: view.requires.codes },
        address: view.address,
      })),
    })),
  };
}

test('the backend catalog is the checked-in contract v3', async ({ context }) => {
  const contract = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'lib/tasks/contract-v3.json'), 'utf-8')
  ) as Catalog;
  const session = (await context.cookies()).find((c) => c.name === 'it_aware_access');
  expect(session).toBeTruthy();
  const api = await request.newContext({ extraHTTPHeaders: { Cookie: `it_aware_access=${session!.value}` } });
  const response = await api.get(`${API_URL}/tasks/catalog`);
  expect(response.status()).toBe(200);
  const backend = (await response.json()) as Catalog;
  await api.dispose();

  expect(compared(backend)).toEqual(compared(contract));
});
