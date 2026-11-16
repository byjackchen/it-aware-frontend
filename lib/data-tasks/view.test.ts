import { expect, it } from 'vitest';
import { cell, isRawSource, param, parsePage, RAW_SOURCES, rawSourceOf, withQuery } from '@/lib/data-tasks/view';

it('has a raw source for each view of View Raw Records, and none for the tier-4 chat text', () => {
  expect([...RAW_SOURCES.entries()]).toEqual([
    ['servicenow-incident', 'servicenow_incident'],
    ['servicenow-incident-assessment', 'servicenow_incident_assessment'],
    ['servicenow-asmt-assessment-instance', 'servicenow_asmt_assessment_instance'],
    ['itaware-campaigns-surveys', 'itaware_campaigns_surveys'],
    ['erp-orginfo', 'erp_orginfo'],
    ['erp-locationinfo', 'erp_locationinfo'],
  ]);
  expect(rawSourceOf('erp-orginfo')).toBe('erp_orginfo');
  expect(rawSourceOf('oit-chatbot-cycles')).toBeNull();
  expect(isRawSource('servicenow_incident')).toBe(true);
  expect(isRawSource('oit_chatbot_cycles')).toBe(false);
});

it('reads a search parameter, a page and builds an address with the set ones only', () => {
  expect(param(undefined)).toBeNull();
  expect(param('  ')).toBeNull();
  expect(param([' INC1 ', 'INC2'])).toBe('INC1');
  expect(parsePage('3')).toBe(3);
  for (const bad of [undefined, '0', '-1', '1.5', 'x']) expect(parsePage(bad)).toBe(1);
  expect(withQuery('/tasks/it-csat', { incident: null, page: 2 })).toBe('/tasks/it-csat?page=2');
  expect(withQuery('/tasks/it-csat', { incident: '', page: null })).toBe('/tasks/it-csat');
});

it('shows a value as text, compact JSON or a dash', () => {
  expect(cell(null)).toBe('—');
  expect(cell(undefined)).toBe('—');
  expect(cell('')).toBe('—');
  expect(cell('Closed')).toBe('Closed');
  expect(cell(3)).toBe('3');
  expect(cell(false)).toBe('false');
  expect(cell({ answers: [1] })).toBe('{"answers":[1]}');
});
