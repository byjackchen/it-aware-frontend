import { getTaskHome } from '@/lib/api/tasks';
import { LegacyMenuList } from './LegacyMenuList';

/**
 * The old-style menu, shown only while the task UI is off (the backend's tasks
 * switch: GET /tasks/home answers 404, so getTaskHome() is null). Drawn from the
 * legacy registry (lib/legacy/); retired with it.
 *
 * Any other failure to read the home shows the menu too: a person keeps a way
 * to every page they can open.
 */
export async function LegacyMenu() {
    const home = await getTaskHome().catch(() => null);
    if (home) return null;
    return <LegacyMenuList />;
}
