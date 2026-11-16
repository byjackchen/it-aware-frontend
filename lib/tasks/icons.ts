/**
 * The icon each task is drawn with (the contract's `icon`, a lucide name in
 * kebab-case), resolved through an explicit map so only these icons are
 * bundled. A name the map lacks resolves to null, and the tile shows the
 * task's first letter instead. lib/tasks/icons.test.ts fails while a task of
 * the catalog names an icon that is not here.
 */

import {
    BellIcon,
    BookOpenIcon,
    BotIcon,
    ChartNoAxesColumnIcon,
    ChartPieIcon,
    ClipboardCheckIcon,
    ClipboardListIcon,
    FlagIcon,
    GaugeIcon,
    HeadsetIcon,
    HourglassIcon,
    KeyRoundIcon,
    LayersIcon,
    LibraryIcon,
    LinkIcon,
    MessagesSquareIcon,
    MonitorIcon,
    PackageIcon,
    RouteIcon,
    TerminalIcon,
    TicketIcon,
    TimerIcon,
    TriangleAlertIcon,
    UserRoundSearchIcon,
    UsersIcon,
    type LucideIcon,
} from 'lucide-react';
import { TASKS } from './catalog';

export const TASK_ICONS: Readonly<Record<string, LucideIcon>> = {
    'bell': BellIcon,
    'book-open': BookOpenIcon,
    'bot': BotIcon,
    'chart-no-axes-column': ChartNoAxesColumnIcon,
    'chart-pie': ChartPieIcon,
    'clipboard-check': ClipboardCheckIcon,
    'clipboard-list': ClipboardListIcon,
    'flag': FlagIcon,
    'gauge': GaugeIcon,
    'headset': HeadsetIcon,
    'hourglass': HourglassIcon,
    'key-round': KeyRoundIcon,
    'layers': LayersIcon,
    'library': LibraryIcon,
    'link': LinkIcon,
    'messages-square': MessagesSquareIcon,
    'monitor': MonitorIcon,
    'package': PackageIcon,
    'route': RouteIcon,
    'terminal': TerminalIcon,
    'ticket': TicketIcon,
    'timer': TimerIcon,
    'triangle-alert': TriangleAlertIcon,
    'user-round-search': UserRoundSearchIcon,
    'users': UsersIcon,
};

/** The component of a lucide name; null for a name the map lacks. */
export function iconNamed(name: string | null | undefined): LucideIcon | null {
    return (name && Object.hasOwn(TASK_ICONS, name) && TASK_ICONS[name]) || null;
}

/** The icon of the catalog's task `code`; null for a code that is no task, or one whose icon the map lacks. */
export function taskIcon(code: string): LucideIcon | null {
    return iconNamed(TASKS.find(task => task.code === code)?.icon);
}
