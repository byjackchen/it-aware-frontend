/**
 * Whether the layout shows the old-style menu (components/legacy/LegacyMenuList).
 *
 * It does when the person's pins are null: the home the layout already reads
 * for the task frame did not answer, because the backend's tasks switch
 * (IT_AWARE_TASKS_ENABLED) is off or the call failed. So the menu costs no
 * extra backend call, and it goes once the task UI answers. An empty list of
 * pins is an answer: the task UI is on, and the menu is not shown.
 */
export function showsLegacyMenu(pinned: readonly string[] | null): boolean {
    return pinned === null;
}
