import { describe, expect, it } from 'vitest';
import { SIDEBAR_CONFIG } from './sidebar';
import { PERMISSIONS } from './permissions';

describe('Ohla Journey navigation authorization', () => {
  for (const grant of [PERMISSIONS.UI.NAVIGATION_OPERATION, PERMISSIONS.DASHBOARDS.OHLA_JOURNEY_READ]) {
    it(`shows all report pages with ${grant}`, () => {
      const items = SIDEBAR_CONFIG['/ohla-journey'].items ?? [];
      expect(items).toHaveLength(8);
      expect(items.every((item) => item.permissions?.checkType === 'any'
        && item.permissions.requiredPermissions.some((permission) => permission === grant))).toBe(true);
    });
  }
});
