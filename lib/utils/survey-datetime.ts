import { formatDateTime } from './datetime';

/** Localize the provenance stamp for display only; keep stored/editable text intact. */
export function formatSurveyIntro(intro: string, timezone: string): string {
    if (!intro.startsWith('Source: ServiceNow Assessment ')) return intro;

    // The assessment feed sends UTC without an offset. Date-only Due values
    // describe a calendar date and must not shift when the profile zone changes.
    return intro.replace(
        /^(Created: |Due: )(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?=\r?$)/gm,
        (original, label: string, date: string, time: string) => {
            const value = `${date}T${time}Z`;
            if (Number.isNaN(new Date(value).getTime())) return original;
            return `${label}${formatDateTime(value, timezone)}`;
        },
    );
}
