/**
 * Home page - Server Component. The signed-in person's tasks: pinned (by
 * them, or set by their admin), recent, and the rest. While the backend's tasks
 * switch is off there is no home, and the address goes where people landed
 * before.
 */

import { redirect } from 'next/navigation';
import { getTaskHome } from '@/lib/api/tasks';
import { LANDING_BEFORE_HOME } from '@/lib/tasks/landing';
import { HomePage } from './HomePage';

export default async function Home() {
    const home = await getTaskHome();
    if (!home) {
        redirect(LANDING_BEFORE_HOME);
    }
    return <HomePage home={home} />;
}
