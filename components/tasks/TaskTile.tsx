/**
 * The small square beside a task's name, on the home and in search: the first
 * letter of the name, or the icon it is given.
 */

interface TaskTileProps {
    name: string;
    small?: boolean;
    children?: React.ReactNode;
}

export function TaskTile({ name, small = false, children }: TaskTileProps) {
    return (
        <span
            aria-hidden="true"
            className={`grid shrink-0 place-items-center bg-accent-soft font-bold text-accent ${small ? 'h-[30px] w-[30px] rounded-lg text-[13px]' : 'h-9 w-9 rounded-[10px] text-[15px]'}`}
        >
            {children ?? [...name.trim()][0]?.toUpperCase()}
        </span>
    );
}
