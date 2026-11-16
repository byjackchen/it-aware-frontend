/**
 * Home page - Server Component. The signed-in person's tasks: pinned (by
 * them, or set by their admin), recent, and the rest. A home the backend
 * cannot give is an error like any other page's (app/(main)/error.tsx).
 */

import { getTaskHome } from '@/lib/api/tasks';
import { HomePage } from './HomePage';

export default async function Home() {
    return <HomePage home={await getTaskHome()} />;
}
