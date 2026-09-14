import { test as it, expect } from '@playwright/test';

const describe = it.describe;
import { formatSurveyIntro } from '../lib/utils/survey-datetime';
import { formatDate, formatDateTime } from '../lib/utils/datetime';

describe('survey timestamps in the profile timezone', () => {
    it('uses the selected calendar day across a UTC date boundary', () => {
        const instant = '2026-09-14T02:30:00Z';
        expect(formatDate(instant, 'America/Chicago', {}, 'en-US')).toBe('9/13/2026 (America/Chicago)');
        expect(formatDate(instant, 'Asia/Shanghai', {}, 'en-US')).toBe('9/14/2026 (Asia/Shanghai)');
    });

    it('respects daylight saving time when displaying the same UTC hour', () => {
        const options = { hour: '2-digit', minute: '2-digit', hour12: false } as const;
        expect(formatDateTime('2026-01-14T12:00:00Z', 'America/Chicago', options, 'en-GB')).toBe('06:00 (America/Chicago)');
        expect(formatDateTime('2026-09-14T12:00:00Z', 'America/Chicago', options, 'en-GB')).toBe('07:00 (America/Chicago)');
    });

    it('localizes ServiceNow provenance without altering date-only deadlines or other text', () => {
        const intro = 'Source: ServiceNow Assessment AINST1\nCreated: 2026-09-14 02:30:00\nDue: 2026-09-28\nView in ServiceNow: https://example.com';
        const chicago = formatSurveyIntro(intro, 'America/Chicago');
        const shanghai = formatSurveyIntro(intro, 'Asia/Shanghai');
        expect(chicago).toContain('Created: ' + formatDateTime('2026-09-14T02:30:00Z', 'America/Chicago'));
        expect(shanghai).toContain('Created: ' + formatDateTime('2026-09-14T02:30:00Z', 'Asia/Shanghai'));
        expect(chicago).not.toBe(shanghai);
        expect(chicago).toContain('\nDue: 2026-09-28\nView in ServiceNow: https://example.com');
        expect(intro).toContain('Created: 2026-09-14 02:30:00');
    });

    it('preserves ordinary survey prose and unrecognized timestamps', () => {
        const prose = 'Created: 2026-09-14 02:30:00';
        expect(formatSurveyIntro(prose, 'Asia/Shanghai')).toBe(prose);
        const invalid = 'Source: ServiceNow Assessment AINST1\nCreated: unknown';
        expect(formatSurveyIntro(invalid, 'Asia/Shanghai')).toBe(invalid);
    });
});
