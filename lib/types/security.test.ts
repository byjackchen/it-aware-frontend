import { describe, expect, it } from 'vitest';
import { canLinkSystem, isIntegrationAccount } from '@/lib/types/security';

// system and agent were merged into integration (it-aware-backend 2de7e84,
// ohla-xray TODO00000135); rows may still hold the old values during the rollout.
describe('account types', () => {
  it.each([
    ['integration', true, true],
    ['system', true, true],
    ['agent', true, false],
    ['user', false, false],
    [undefined, false, false],
  ])('%s: integration %s, may link a system %s', (type, integration, links) => {
    expect(isIntegrationAccount(type)).toBe(integration);
    expect(canLinkSystem(type)).toBe(links);
  });
});
