/**
 * Which task a page belongs to. Used by the reporting-only checks in
 * e2e/tasks-catalog.spec.ts ("every page belongs to a task").
 */

export interface TaskAddress {
    code: string;
    opens: string;
}

/** The address of a page file: `app/(main)/data/incidents/[oid]/page.tsx` → `/data/incidents/[oid]`. */
export function pageAddress(file: string): string {
    const segments = file
        .replace(/\\/g, '/')
        .replace(/^.*?app\//, '')
        .split('/')
        .slice(0, -1) // page.tsx
        .filter(segment => !/^\(.*\)$/.test(segment)); // route groups
    return `/${segments.join('/')}`;
}

/** Whether the page's address is the task's or lies under it; a `[name]` segment of the page stands for any value. */
function covers(opens: string, address: string): boolean {
    const page = address.split('/');
    return opens.split('/').every((segment, i) => page[i] === segment || /^\[.*\]$/.test(page[i] ?? ''));
}

/** The task whose address is the page's or the nearest above it; undefined when none. */
export function owningTask<T extends TaskAddress>(address: string, tasks: T[]): T | undefined {
    return tasks
        .filter(task => covers(task.opens, address))
        .sort((a, b) => b.opens.length - a.opens.length)[0];
}

/** The addresses, sorted, of the pages no task covers. */
export function pagesWithoutTask(files: string[], tasks: TaskAddress[]): string[] {
    return files
        .map(pageAddress)
        .filter(address => !owningTask(address, tasks))
        .sort();
}
