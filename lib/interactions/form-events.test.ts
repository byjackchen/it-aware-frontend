import { describe, expect, it } from 'vitest';
import {
    FORM_EVENT_LABELS,
    formBadge,
    formEventLabel,
    formFilterQuery,
    formValueRows,
} from './form-events';

describe('formFilterQuery', () => {
    it('maps each filter to the list parameters', () => {
        expect(formFilterQuery('all')).toEqual({});
        expect(formFilterQuery('requests')).toEqual({ form_final: 'true' });
        expect(formFilterQuery('turns')).toEqual({ has_form: 'true' });
    });
});

describe('formEventLabel and formBadge', () => {
    it('labels known events and keeps unknown ones', () => {
        expect(formEventLabel('submitted')).toBe(FORM_EVENT_LABELS.submitted);
        expect(formEventLabel('rejected')).toBe('Rejected by ServiceNow');
        expect(formEventLabel('later_event')).toBe('later_event');
        expect(formEventLabel(null)).toBe('');
        expect(formEventLabel(undefined)).toBe('');
    });

    it('joins item, event and ticket, skipping what is missing', () => {
        expect(
            formBadge({ form_event: 'submitted', form_item_name: 'Gate Tool', form_ticket_number: 'RITM0000001' }),
        ).toBe('Gate Tool · Submitted · RITM0000001');
        expect(formBadge({ form_event: 'started', form_item_name: null })).toBe('Started');
        expect(formBadge({ form_event: null, form_item_name: 'Gate Tool' })).toBeNull();
        expect(formBadge({})).toBeNull();
    });
});

describe('formValueRows', () => {
    it('returns nothing without values', () => {
        expect(formValueRows(null)).toEqual([]);
        expect(formValueRows(undefined)).toEqual([]);
    });

    it('turns entries into rows in label order', () => {
        const rows = formValueRows({
            request_type: { label: 'Request Type', value: '1', display: 'Request Access', cycle_id: 'c-1' },
            justification: { label: 'Business Justification', value: 'gate work' },
            bare: 'plain',
            counted: { value: 3 },
            empty: { value: null },
        });
        expect(rows.map((r) => r.label)).toEqual([
            'bare',
            'Business Justification',
            'counted',
            'empty',
            'Request Type',
        ]);
        expect(rows[4]).toEqual({
            name: 'request_type',
            label: 'Request Type',
            shown: 'Request Access',
            value: '1',
            cycleId: 'c-1',
        });
        expect(rows[0]).toMatchObject({ shown: 'plain', value: 'plain', cycleId: null });
        expect(rows[1]).toMatchObject({ shown: 'gate work', cycleId: null });
        expect(rows[2]).toMatchObject({ shown: '3', value: '3' });
        expect(rows[3]).toMatchObject({ shown: '', value: '' });
    });
});
