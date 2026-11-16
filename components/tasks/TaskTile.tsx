/**
 * The small square beside a task's name, on the home, in search and in the
 * task frame: the task's icon (by its code, lib/tasks/icons.ts), the icon it
 * is given, or else the first letter of the name.
 */

import { createElement } from 'react';
import { taskIcon } from '@/lib/tasks/icons';

interface TaskTileProps {
    name: string;
    /** The task's code: the tile draws its icon from the catalog. */
    task?: string;
    small?: boolean;
    children?: React.ReactNode;
}

export function TaskTile({ name, task, small = false, children }: TaskTileProps) {
    const Icon = task ? taskIcon(task) : null;
    return (
        <span
            aria-hidden="true"
            data-testid="task-tile"
            className={`grid shrink-0 place-items-center bg-accent-soft font-bold text-accent ${small ? 'h-[30px] w-[30px] rounded-lg text-[13px]' : 'h-9 w-9 rounded-[10px] text-[15px]'}`}
        >
            {Icon
                ? createElement(Icon, { className: small ? 'h-4 w-4' : 'h-[18px] w-[18px]' })
                : children ?? [...name.trim()][0]?.toUpperCase()}
        </span>
    );
}
